import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from urllib.parse import urlparse

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel

from app.employer_verification_model.feature_engine import fetch_website_bundle, normalize_website_url
from app.employer_verification_model.review_aggregator import (
    is_job_board_url,
    normalize_company_name,
)
from app.employer_verification_model.scoring_layer import (
    calculate_final_score,
    check_reputation,
)

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def search_company_website(company_name: str) -> str | None:
    """Quick website discovery (1-2 queries, no artificial sleep)."""
    from duckduckgo_search import DDGS

    bad_domains = [
        "facebook.com",
        "linkedin.com",
        "twitter.com",
        "wikipedia.org",
        "adaderana.lk",
        "ft.lk",
        "dailymirror.lk",
        "investing.com",
        "glassdoor.com",
        "indeed.com",
        "bloomberg.com",
        "reuters.com",
        "youtube.com",
        "crunchbase.com",
        "zoominfo.com",
    ]
    queries = [
        f'"{company_name}" site:.lk',
        f'"{company_name}" official website Sri Lanka',
    ]
    for query in queries:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
            for r in results:
                url = r.get("href", "")
                if any(bd in url for bd in bad_domains):
                    continue
                if ".lk" in url:
                    return url
            for r in results:
                url = r.get("href", "")
                if url and not any(bd in url for bd in bad_domains):
                    return url
        except Exception:
            continue
    return None


MODEL_PATH = os.path.join(os.path.dirname(__file__), "../models/final_realistic_model.pkl")
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
    )

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
    def _reg():
        if not company_name:
            return {}
        return check_registration_status(company_name, company_site_url or url)

    def _rep():
        return check_reputation(company_name or "", url)

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

    with ThreadPoolExecutor(max_workers=3) as pool:
        f_reg = pool.submit(_reg)
        f_rep = pool.submit(_rep)
        f_site = pool.submit(_site)
        reg_signals = f_reg.result()
        rep_signals = f_rep.result()
        site_bundle = f_site.result()

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

    if company_name:
        info_available.append("company_name")
        features.update({k: v for k, v in reg_signals.items() if isinstance(v, (int, float))})
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

        features["has_about"] = int(page_signals.get("has_about") or 0)
        features["has_contact"] = int(page_signals.get("has_contact") or 0)
        features["has_privacy_policy"] = int(page_signals.get("has_privacy_policy") or 0)
        features["has_terms"] = int(page_signals.get("has_terms") or 0)

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
    return features, info_available, reg_signals, rep_signals, resolved_site, company_name


@app.post("/predict")
def predict_company(input: CompanyInput):
    t0 = time.perf_counter()
    features, info_available, reg_signals, rep_signals, resolved_url, company_name = extract_features_from_input(
        input
    )

    print("\n[DEBUG] Features sent to model:")
    for k in feature_cols:
        print(f"  {k}: {features.get(k)}")
    print(
        f"[DEBUG] presence linkedin={features.get('has_linkedin')} "
        f"facebook={features.get('has_social_facebook')} "
        f"instagram={features.get('has_social_instagram')}"
    )

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

    elapsed = time.perf_counter() - t0
    logger.info("[TIMING] /predict total %.2fs for %s", elapsed, company_name)
    print(f"[TIMING] /predict total {elapsed:.2f}s")

    return {
        "prediction": prediction,
        "probability": probability,
        "confidence": confidence,
        "warning": warning,
        "features_used": features,
        "risk_score": score_result["legitimacy_score"],
        "risk_level": score_result["risk_level"],
        "verdict": score_result["verdict"],
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
        "recommendation": score_result["recommendation"],
        "score_breakdown": score_result["score_breakdown"],
        "elapsed_seconds": round(elapsed, 2),
    }


@app.get("/")
def root():
    return {"message": "Employer Verification API is running."}
