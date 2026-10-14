import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Optional
from urllib.parse import urlparse

import joblib
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

from app.employer_verification_model.feature_engine import fetch_website_bundle, normalize_website_url
from app.employer_verification_model.review_aggregator import (
    is_job_board_url,
    normalize_company_name,
)
from app.user_result import build_user_result, has_fraud_signals
from app.employer_verification_model.scoring_layer import (
    calculate_final_score,
    check_reputation,
)

load_dotenv()

# Hard limit (seconds) for the whole parallel evidence collection. A slow source is reported as
# unavailable instead of making the user wait; the individual checks also have their own budgets.
CHECK_TIMEOUT = float(os.getenv("CHECK_TIMEOUT_SECONDS", "30"))

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


_DOC_EXTENSIONS = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".rar")
_BAD_SITE_DOMAINS = (
    "facebook.com", "linkedin.com", "twitter.com", "instagram.com", "tiktok.com", "youtube.com", "x.com",
    "wikipedia.org", "adaderana.lk", "ft.lk", "dailymirror.lk", "newsfirst.lk", "island.lk", "lankadeepa.lk",
    "investing.com", "glassdoor.com", "indeed.com", "bloomberg.com", "reuters.com", "crunchbase.com",
    "zoominfo.com", "rocketreach.co", "dnb.com", "opencorporates.com", "scribd.com", "slideshare.net",
    "topjobs.lk", "ikman.lk", "yellowpages", "lankayp", "gov.lk", "sdb.lk", "cbsl.gov.lk", "cse.lk",
    "trustpilot.com", "goodfirms.co", "clutch.co", "wordpress.com", "blogspot.com",
)
_GENERIC_SITE_WORDS = {
    "trading", "traders", "enterprises", "enterprise", "industries", "industry", "lanka", "pvt", "ltd",
    "limited", "private", "company", "holdings", "group", "international", "services", "sri", "plc",
}


def _website_fits_company(url: str, title: str, body: str, company_name: str) -> bool:
    """An auto-found address is used only if it can be this company's own website.
    Rejects documents (a bank's warning PDF), directories/news/government pages, and sites whose
    address has nothing to do with the company name."""
    import re
    from app.employer_verification_model.registration_utils import (
        LEGAL_SUFFIXES, _distinctive_tokens, _normalize_company,
    )

    parsed = urlparse(url or "")
    host = (parsed.netloc or "").lower().split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    path = (parsed.path or "").lower()
    if not host or path.endswith(_DOC_EXTENSIONS):
        return False
    if any(bd in host for bd in _BAD_SITE_DOMAINS):
        return False

    parts = [p for p in host.split(".") if p]
    while len(parts) > 1 and parts[-1] in {"lk", "com", "co", "org", "net", "gov", "edu", "ac", "info", "biz", "io"}:
        parts.pop()
    label = re.sub(r"[^a-z0-9]", "", "".join(parts))
    if len(label) < 3:
        return False

    all_tokens = [w for w in _normalize_company(company_name).split() if w not in LEGAL_SUFFIXES]
    compact = re.sub(r"[^a-z0-9]", "", "".join(all_tokens))
    brand = [t for t in _distinctive_tokens(company_name) if t not in _GENERIC_SITE_WORDS]
    name_in_address = bool(compact) and (compact in label or (len(label) >= 4 and label in compact))
    if brand:
        first = brand[0]
        name_in_address = name_in_address or label.startswith(first) or (len(first) >= 5 and first in label)
    if not name_in_address:
        return False

    # A company address outside .lk must say it is in Sri Lanka (hs-trading.com is not a Colombo firm).
    if not host.endswith(".lk"):
        text = f"{title} {body} {url}".lower()
        if not any(k in text for k in ("sri lanka", "lanka", "colombo")):
            return False
    return True


def search_company_website(company_name: str) -> str | None:
    """Quick website discovery (1-2 queries). Only returns an address that fits the company name."""
    from app.employer_verification_model.search_client import get_ddgs_class
    DDGS = get_ddgs_class()

    queries = [
        f'"{company_name}" site:.lk',
        f'"{company_name}" official website Sri Lanka',
    ]
    for query in queries:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
        except Exception:
            continue
        fitting = [
            r for r in results
            if _website_fits_company(r.get("href", ""), r.get("title", ""), r.get("body", ""), company_name)
        ]
        for r in fitting:
            if ".lk" in (r.get("href") or ""):
                return r.get("href")
        if fitting:
            return fitting[0].get("href")
    return None


def _resolve_model_path() -> str:
    """Find the trained model bundle (override with EMPLOYER_MODEL_PATH)."""
    base = os.path.join(os.path.dirname(__file__), "..", "models")
    candidates = [
        os.getenv("EMPLOYER_MODEL_PATH", ""),
        os.path.join(base, "final_model_v2.pkl"),  # final model used for all reported results
        os.path.join(base, "models", "final_model_v2.pkl"),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return os.path.abspath(path)
    raise FileNotFoundError(
        "Employer model not found. Put final_model_v2.pkl in models/ or set EMPLOYER_MODEL_PATH."
    )


MODEL_PATH = _resolve_model_path()
model_bundle = joblib.load(MODEL_PATH)
model = model_bundle["model"]
feature_cols = model_bundle["features"]

app = FastAPI(title="Employer Verification API")


class CompanyInput(BaseModel):
    company_name: Optional[str] = None
    email: Optional[str] = None
    website_url: Optional[str] = None


FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]
SUSPICIOUS_TLDS = [".xyz", ".club", ".biz", ".online", ".site", ".info", ".io"]


def _derive_content_flags(web_text: str) -> dict:
    """Keyword flags from page body (payment / urgency / scam phrases)."""
    web_text_lower = (web_text or "").lower()
    return {
        "scam_score": sum(
            1
            for word in [
                "urgent",
                "apply now",
                "limited time",
                "registration fee",
                "payment required",
                "bitcoin",
                "crypto",
                "wire transfer",
                "guaranteed job",
                "no experience needed",
                "earn money fast",
                "work from home easily",
            ]
            if word in web_text_lower
        ),
        "has_payment_risk": int(
            any(
                k in web_text_lower
                for k in [
                    "cryptocurrency",
                    "bitcoin",
                    "btc",
                    "usdt",
                    "wire transfer",
                    "western union",
                    "moneygram",
                    "cash app",
                    "send money first",
                    "pay to apply",
                    "payoneer advance",
                ]
            )
        ),
        "has_urgency_language": int(
            any(
                k in web_text_lower
                for k in [
                    "act now",
                    "limited time",
                    "urgent",
                    "hurry",
                    "expires soon",
                    "don't miss",
                    "apply immediately",
                    "today only",
                    "last chance",
                    "seats are limited",
                    "only a few spots",
                ]
            )
        ),
    }


def extract_features_from_input(input: CompanyInput):
    """
    Build ML features once. Registry + reputation run in parallel and are
    returned so /predict can reuse them in scoring (no second network pass).
    """
    from app.employer_verification_model.registration_utils import (
        check_registration_status,
        partial_registration_result,
    )
    from app.employer_verification_model.review_aggregator import partial_review_signals
    from app.employer_verification_model.legal_name_discovery import discover_legal_names
    from app.employer_verification_model.registration_utils import quick_registry_lookup

    t0 = time.perf_counter()
    features = {col: 0 for col in feature_cols}
    info_available = []
    reg_signals: dict = {}
    rep_signals: dict = {}

    company_name = normalize_company_name(input.company_name)
    if company_name and company_name != (input.company_name or "").strip():
        logger.info("[INPUT] normalized company name %r -> %r", input.company_name, company_name)

    url = normalize_website_url(input.website_url)
    job_board_url = is_job_board_url(url)
    auto_searched = False

    # Job-ad links are not company websites — still scrape them for social links,
    # but also try to discover the real company site for ML website features.
    company_site_url = None if job_board_url else url
    if (not company_site_url) and company_name:
        found = normalize_website_url(search_company_website(company_name))
        if found and not is_job_board_url(found):
            company_site_url = found
            auto_searched = True
            logger.info("[TIMING] website search %.2fs -> %s", time.perf_counter() - t0, company_site_url)

    site_fetch_url = company_site_url or url

    # Parallel: registry + reputation/reviews (+ optional site text)
    # Reputation uses the original URL (job post may contain Facebook/LinkedIn links).
    data_warnings: list = []

    reg_progress: dict = {}

    def _reg():
        if not company_name:
            return {}
        try:
            return check_registration_status(company_name, company_site_url or url, reg_progress)
        except Exception as exc:  # registry sources are external; never fail the request
            logger.warning("[REG] registry check failed: %s", str(exc)[:200])
            data_warnings.append("Official registry lookup was unavailable, so registration could not be checked this time.")
            return {"registry_unavailable": 1}

    rep_progress: dict = {}

    def _rep():
        try:
            return check_reputation(company_name or "", url, rep_progress)
        except Exception as exc:
            logger.warning("[REP] reputation check failed: %s", str(exc)[:200])
            data_warnings.append("Reputation sources were unavailable, so reviews and scam reports could not be checked.")
            return {}

    def _site():
        if not site_fetch_url:
            return {"text": "", "signals": {}}
        # Don't treat job-board HTML as the company's About/Contact pages
        if job_board_url and site_fetch_url == url and not company_site_url:
            return {"text": "", "signals": {}, "job_board_skipped": True}
        try:
            return fetch_website_bundle(site_fetch_url)
        except Exception:
            return {"text": "", "signals": {}}

    pool = ThreadPoolExecutor(max_workers=3)
    try:
        f_reg = pool.submit(_reg)
        f_rep = pool.submit(_rep)
        f_site = pool.submit(_site)
        _deadline = time.monotonic() + CHECK_TIMEOUT

        def _wait(future, fallback, warning):
            try:
                return future.result(timeout=max(0.1, _deadline - time.monotonic()))
            except FutureTimeout:
                logger.warning("[TIMEOUT] a source did not answer within %.0fs", CHECK_TIMEOUT)
                if warning:
                    data_warnings.append(warning)
                return fallback

        # If the registry check runs out of time, keep whatever it found so far instead of discarding it.
        reg_signals = _wait(f_reg, None, None)
        if reg_signals is None:
            reg_signals = partial_registration_result(reg_progress)
            data_warnings.append(
                "The official registers took too long to answer, so registration was only partly checked this time."
                if reg_signals.get("registry_partial")
                else "The official registers took too long to answer, so registration was not checked this time."
            )
            logger.warning("[TIMEOUT] registry check cut short; partial=%s", bool(reg_signals.get("registry_partial")))
        rep_signals = _wait(f_rep, None, None)
        if rep_signals is None:  # keep what was found (e.g. LinkedIn) instead of discarding everything
            rep_signals = partial_review_signals(rep_progress)
            data_warnings.append("Reputation sources took too long to answer, so reviews and scam reports were only partly checked.")
        site_bundle = _wait(f_site, {"text": "", "signals": {}}, None)
    finally:
        pool.shutdown(wait=False)  # do not block the answer on a slow source still running

    web_text = site_bundle.get("text") or ""
    page_signals = site_bundle.get("signals") or {}
    link_count = int(page_signals.get("link_count") or 0)
    html_len = int(page_signals.get("html_len") or 0)
    logger.info(
        "[TIMING] parallel checks %.2fs (reg=%s job_board=%s linkedin=%s fb=%s)",
        time.perf_counter() - t0,
        reg_signals.get("registration_method") or reg_signals.get("government_registration_status"),
        job_board_url,
        rep_signals.get("has_linkedin"),
        rep_signals.get("has_social_facebook"),
    )

    # Legal name written on the website: look it up, but only as a weaker "claimed" match (a site can copy any name).
    website_legal_name = None
    if company_name and web_text and not any(
        reg_signals.get(k) for k in ("is_cse_listed", "is_cbsl_licensed", "is_drc_registered",
                                      "is_boi_registered", "is_slaasmb_registered")
    ):
        try:
            for cand in discover_legal_names(web_text, company_name, site_fetch_url):
                hit = quick_registry_lookup(cand)
                if hit:
                    website_legal_name = {"name": cand, "register": hit["register"], "reg_name": hit["reg_name"]}
                    reg_signals["government_registration_status"] = "unverified"
                    reg_signals["registration_via_website_name"] = 1
                    reg_signals["website_legal_name"] = website_legal_name
                    logger.info("[REG] website names %r, found on %s (claimed, not counted as official)", cand, hit["register"])
                    break
        except Exception as exc:
            logger.debug("[REG] legal-name discovery failed: %s", str(exc)[:120])

    if company_name:
        info_available.append("company_name")
        features.update({k: v for k, v in reg_signals.items()
                         if isinstance(v, (int, float)) and k not in ("registry_unavailable", "registry_partial",
                                                      "registration_via_website_name")})
        # Align ML feature name
        features["is_registered"] = int(
            reg_signals.get("government_registration_status") == "registered"
            or reg_signals.get("is_cse_listed")
            or reg_signals.get("is_drc_registered")
            or reg_signals.get("is_boi_registered")
            or reg_signals.get("is_cbsl_licensed")
            or 0
        )
        for k in (
            "has_glassdoor",
            "has_indeed",
            "has_linkedin",
            "has_trustpilot",
            "has_topjobs_lk",
            "has_ft_lk",
            "has_ikman_lk",
            "has_social_facebook",
            "has_social_instagram",
            "has_social_x",
            "has_social_youtube",
            "has_social_reddit",
            "has_website_reviews",
            "has_positive_reviews",
            "has_negative_reviews",
            "social_only_presence",
            "has_scam_report",
        ):
            if k in rep_signals:
                features[k] = int(rep_signals.get(k) or 0)

    resolved_site = company_site_url or (None if job_board_url else url)
    features["website_checked"] = site_fetch_url
    if resolved_site:
        info_available.append("website")
        features["auto_searched_website"] = auto_searched
        host = (urlparse(str(resolved_site)).netloc or "").lower()
        social_hosts = (
            "facebook.com",
            "fb.com",
            "instagram.com",
            "linkedin.com",
            "twitter.com",
            "x.com",
            "youtube.com",
            "tiktok.com",
        )
        is_social_url = any(h in host for h in social_hosts)
        if is_social_url:
            features["social_only_presence"] = 1
            rep_signals["social_only_presence"] = 1

        features["has_https"] = int(str(resolved_site).startswith("https://"))
        features["subdomain_count"] = str(urlparse(resolved_site).netloc).count(".")
        features["domain_length"] = len(urlparse(resolved_site).netloc)
        features["content_length"] = len(web_text or "")
        scrape_failed = (
            (not is_social_url)
            and len(web_text or "") < 100
            and link_count < 3
            and html_len < 1500
        )
        features["scrape_failed"] = int(scrape_failed)

        # If the homepage could not be read, page flags can only have come from
        # blind URL probes (JS shells and soft-404s answer 200 for any path),
        # so they are treated as unknown rather than as evidence.
        _trust_pages = not scrape_failed
        features["has_about"] = int(page_signals.get("has_about") or 0) if _trust_pages else 0
        features["has_contact"] = int(page_signals.get("has_contact") or 0) if _trust_pages else 0
        features["has_privacy_policy"] = int(page_signals.get("has_privacy_policy") or 0) if _trust_pages else 0
        features["has_terms"] = int(page_signals.get("has_terms") or 0) if _trust_pages else 0

        if scrape_failed and not any(
            features[k] for k in ("has_about", "has_contact", "has_privacy_policy", "has_terms")
        ):
            features["has_about"] = -1
            features["has_contact"] = -1
            features["scam_score"] = -1
            features["has_privacy_policy"] = -1
            features["has_terms"] = -1
            features["has_payment_risk"] = 0
            features["has_urgency_language"] = 0
            features["content_score"] = 0
        else:
            features.update(_derive_content_flags(web_text))
            features["content_score"] = min(100.0, round(max(len(web_text), html_len / 50) / 200.0, 2))

        features["has_suspicious_tld"] = int(any(t in str(resolved_site).lower() for t in SUSPICIOUS_TLDS))
        features["is_http_only"] = int(not features["has_https"])
    elif job_board_url:
        info_available.append("job_listing")
        # Job ad URL only — website features stay unknown, presence comes from reputation
        if any(
            int(features.get(k) or 0) == 1
            for k in ("has_social_facebook", "has_social_instagram", "has_linkedin")
        ):
            features["social_only_presence"] = 1
            rep_signals["social_only_presence"] = 1
    elif int(features.get("social_only_presence") or 0) == 1 or any(
        int(features.get(k) or 0) == 1
        for k in ("has_social_facebook", "has_social_instagram", "has_linkedin")
    ):
        info_available.append("social_presence")
        features["social_only_presence"] = 1
        rep_signals["social_only_presence"] = 1

    if input.email:
        info_available.append("email")
        domain = input.email.split("@")[-1]
        features["email_type_encoded"] = 0 if domain in FREE_EMAIL_DOMAINS else 2
    else:
        features["email_type_encoded"] = 1

    features["trust_score"] = sum(
        features.get(c, 0)
        for c in [
            "has_https",
            "has_about",
            "has_contact",
            "has_privacy_policy",
            "has_terms",
            "is_registered",
            "website_alive",
            "has_glassdoor",
            "has_indeed",
            "has_trustpilot",
            "has_topjobs_lk",
            "has_ikman_lk",
            "has_ft_lk",
            "has_cse_boi_mention",
            "has_positive_reviews",
        ]
        if c in features and isinstance(features.get(c), (int, float)) and features.get(c, 0) > 0
    )
    features["suspicion_score"] = sum(
        features.get(c, 0)
        for c in [
            "has_payment_risk",
            "has_urgency_language",
            "has_suspicious_tld",
            "is_http_only",
            "has_negative_reviews",
        ]
        if c in features and isinstance(features.get(c), (int, float)) and features.get(c, 0) > 0
    )

    for col in feature_cols:
        if features.get(col) is None:
            features[col] = 0
        # model expects numeric
        try:
            features[col] = float(features[col]) if not isinstance(features[col], (int, float)) else features[col]
        except Exception:
            features[col] = 0

    logger.info("[TIMING] feature extract total %.2fs", time.perf_counter() - t0)
    return features, info_available, reg_signals, rep_signals, resolved_site, company_name, data_warnings


def _insufficient_information_response() -> dict:
    """Empty request: report that nothing could be checked instead of inventing a score."""
    msg = "Not enough information provided. Enter at least a company name or a website to run a check."
    return {
        "prediction": "Unknown",
        "model_prediction": "Unknown",
        "probability": 0.0,
        "confidence": "none",
        "warning": msg,
        "data_warnings": [],
        "features_used": {},
        "risk_score": None,
        "risk_level": "Unknown",
        "verdict": "Not enough information to verify this employer",
        "color": "grey",
        "evidence": {},
        "registration_status": None,
        "registration_status_label": "Not checked",
        "registration_summary": None,
        "registration_trace": [],
        "government_registration_source": None,
        "registration_sources": [],
        "registration_method": None,
        "reg_name": None,
        "reg_number": None,
        "opencorporates_url": None,
        "slaasmb_sbe_name": None,
        "recommendation": msg,
        "score_breakdown": {"ml_score": 0, "registration_score": 0, "reputation_score": 0, "website_score": 0},
        "elapsed_seconds": 0.0,
        "user_result": build_user_result("Unknown", None, {}, {}, {}, None, []),
    }


_RESULT_CACHE: dict = {}


def _cache_key(input: CompanyInput) -> str:
    return "|".join((v or "").strip().lower() for v in (input.company_name, input.website_url, input.email))


def _is_complete(result: dict) -> bool:
    """Only keep answers where every source responded, so a temporary outage is never remembered."""
    ur = result.get("user_result") or {}
    if ur.get("notices") or ur.get("band") == "Unknown":
        return False
    return not any(c.get("status") == "unavailable" for c in ur.get("checks", [])
                   if c.get("name") == "Official registration")


@app.post("/predict")
def predict_company(input: CompanyInput):
    """Same company checked again within RESULT_CACHE_SECONDS (default 1 hour) returns the same
    answer straight away; this keeps a repeated check stable and fast. Set RESULT_CACHE_SECONDS=0 to turn off."""
    ttl = float(os.getenv("RESULT_CACHE_SECONDS", "3600") or 0)
    key = _cache_key(input)
    if ttl > 0 and key.strip("|"):
        hit = _RESULT_CACHE.get(key)
        if hit and time.time() - hit[0] < ttl:
            return {**hit[1], "cached": True}
    result = _predict_uncached(input)
    if ttl > 0 and key.strip("|") and isinstance(result, dict) and _is_complete(result):
        _RESULT_CACHE[key] = (time.time(), result)
    return result


def _predict_uncached(input: CompanyInput):
    t0 = time.perf_counter()
    if not any((v or "").strip() for v in (input.company_name, input.website_url, input.email)):
        return _insufficient_information_response()

    features, info_available, reg_signals, rep_signals, resolved_url, company_name, data_warnings = extract_features_from_input(
        input
    )

    logger.debug("Features sent to model: %s", {k: features.get(k) for k in feature_cols})

    X = pd.DataFrame([[features.get(col, 0) for col in feature_cols]], columns=feature_cols)
    pred = model.predict(X)[0]
    proba = model.predict_proba(X)[0][int(pred)]

    company_name = company_name or normalize_company_name(input.company_name) or "Unknown"
    website = resolved_url or normalize_website_url(input.website_url)

    score_result = calculate_final_score(
        ml_probability=float(proba),
        company_name=company_name,
        website=website,
        features=features,
        reg=reg_signals,
        rep=rep_signals,
    )

    content_signals = [
        features.get("content_length", 0) < 100,
        features.get("has_about", 0) in [0, -1],
        features.get("has_contact", 0) in [0, -1],
        features.get("scam_score", 0) in [0, -1],
        features.get("has_privacy_policy", 0) in [0, -1],
        features.get("has_terms", 0) in [0, -1],
    ]
    scrape_failed = features.get("scrape_failed", 0) == 1
    missing_signals = sum(content_signals)
    low_confidence = scrape_failed or missing_signals >= 4

    if not info_available:
        prediction = "Unknown"
        probability = 0.0
        confidence = "low"
        warning = (
            "Not enough information provided. Please provide at least a company name "
            "and website for a meaningful prediction."
        )
    elif len(info_available) == 1 or low_confidence:
        prediction = "Legit" if pred == 1 else "Fake"
        probability = min(float(proba), 0.65)
        confidence = "low"
        warning = (
            "Low confidence — website could not be fully scanned or too little information. "
            "More information (website and email) will improve accuracy."
        )
    else:
        prediction = "Legit" if pred == 1 else "Fake"
        probability = float(proba)
        confidence = "high"
        warning = None

    # The label shown to users must agree with the risk band (the band is the final decision).
    model_prediction = prediction
    band = score_result["risk_level"]
    if prediction != "Unknown":
        prediction = {"Low": "Legit", "Medium": "Uncertain", "High": "Fake"}[band]
        if band == "High" and not has_fraud_signals(features, rep_signals):
            prediction = "Unverified"  # high risk because nothing could be verified, not because fraud was detected

    elapsed = time.perf_counter() - t0
    logger.info("[TIMING] /predict total %.2fs for %s", elapsed, company_name)

    if reg_signals.get("website_legal_name"):
        score_result["evidence"]["website_legal_name"] = reg_signals["website_legal_name"]
    user_result = build_user_result(
        band, score_result["legitimacy_score"], score_result["evidence"], rep_signals, features,
        score_result["evidence"].get("registration_status"), data_warnings,
        registry_unavailable=bool(reg_signals.get("registry_unavailable")), confidence=confidence,
    )

    return {
        "user_result": user_result,
        "prediction": prediction,
        "model_prediction": model_prediction,
        "data_warnings": data_warnings,
        "probability": probability,
        "confidence": confidence,
        "warning": warning,
        "features_used": features,
        "risk_score": score_result["legitimacy_score"],
        "risk_level": score_result["risk_level"],
        "verdict": user_result["headline"],  # one wording everywhere (no "fraud detected" without evidence)
        "color": score_result["color"],
        "evidence": score_result["evidence"],
        "registration_status": score_result["evidence"].get("registration_status"),
        "registration_status_label": score_result["evidence"].get("registration_status_label"),
        "registration_summary": score_result["evidence"].get("registration_summary"),
        "registration_trace": score_result["evidence"].get("registration_trace", []),
        "government_registration_source": score_result["evidence"].get("government_registration_source"),
        "registration_sources": score_result["evidence"].get("registration_sources") or [],
        "registration_method": score_result["evidence"].get("registration_method"),
        "reg_name": score_result["evidence"].get("reg_name"),
        "reg_number": score_result["evidence"].get("reg_number"),
        "opencorporates_url": score_result["evidence"].get("opencorporates_url"),
        "slaasmb_sbe_name": score_result["evidence"].get("slaasmb_sbe_name"),
        "recommendation": user_result["summary"],
        "score_breakdown": score_result["score_breakdown"],
        "website_checked": features.get("website_checked"),
        "elapsed_seconds": round(elapsed, 2),
    }


@app.get("/")
def root():
    return {"message": "Employer Verification API is running."}
