"""
Rule-based scoring layer for employer verification.
Combines ML model output with registration and reputation checks.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError, as_completed
from typing import Dict, Iterable, List, Tuple, Optional
from urllib.parse import urlparse
import re
import logging

from app.employer_verification_model.registration_utils import check_registration_status

logger = logging.getLogger(__name__)


def _normalize_url(url: str) -> str:
    """Normalize URL to handle common malformations."""
    if not url:
        return url

    url = url.strip()
    url = re.sub(r"^([a-z]+);/?/?", r"\1://", url, flags=re.IGNORECASE)
    if not re.match(r"^[a-z]+://", url, re.IGNORECASE):
        url = "https://" + url
    return url


def _normalize_company_tokens(company_name: str) -> List[str]:
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", (company_name or "").lower())
    tokens = [t for t in cleaned.split() if len(t) >= 3]
    return tokens if tokens else [cleaned.replace(" ", "")]


def _company_mention_count(text: str, company_name: str) -> int:
    if not text:
        return 0
    text_lower = text.lower()
    name_compact = re.sub(r"[^a-z0-9]+", "", company_name.lower())
    text_compact = re.sub(r"[^a-z0-9]+", "", text_lower)

    mention_count = 0
    if name_compact and name_compact in text_compact:
        mention_count += 1

    for token in _normalize_company_tokens(company_name):
        if token and token in text_lower:
            mention_count += 1

    return mention_count


def _query_variants(company_name: str, suffix: str) -> List[str]:
    # Multiple variants improve recall when exact quoted search returns empty.
    return [
        f'"{company_name}" {suffix}',
        f"{company_name} {suffix}",
        f"{company_name} Sri Lanka {suffix}",
    ]


def check_lk_registration(company_name: str, website: str = None) -> Dict[str, int]:
    """
    Check if company is registered with official Sri Lanka authorities.
    Uses OpenCorporates when an API token is configured.
    """
    logger.debug("[REG] Checking %s", company_name)

    # Delegate to registration utilities which try OpenCorporates first and
    # then fall back to website heuristics when available.
    result = check_registration_status(company_name, website)

    logger.debug(
        "[REG] result cse=%s boi=%s cbsl=%s drc=%s",
        result.get("is_cse_listed", 0),
        result.get("is_boi_registered", 0),
        result.get("is_cbsl_licensed", 0),
        result.get("is_drc_registered", 0),
    )
    return result


def check_reputation(company_name: str, website: str = None) -> Dict[str, int]:
    """
    Check company's online reputation and presence.
    Uses review_aggregator (website links + social URL + name-based review search),
    matching the training-time review_extractor approach.
    """
    from app.employer_verification_model.review_aggregator import aggregate_review_signals

    logger.debug("[REP] Checking %s", company_name)

    normalized = _normalize_url(website) if website else None
    result = aggregate_review_signals(company_name or "", normalized)

    if any(
        keyword in (company_name or "").lower()
        for keyword in ["scam", "fake", "fraud", "easy money"]
    ):
        result["has_scam_report"] = 1
        logger.debug("[REP] scam keyword detected in company name")

    logger.debug(
        "[REP] result glassdoor=%s indeed=%s linkedin=%s topjobs=%s ft=%s trustpilot=%s "
        "sitejabber=%s fb=%s ig=%s x=%s yt=%s reddit=%s web_reviews=%s pos=%s neg=%s scam=%s social_only=%s",
        result.get("has_glassdoor", 0),
        result.get("has_indeed", 0),
        result.get("has_linkedin", 0),
        result.get("has_topjobs_lk", 0),
        result.get("has_ft_lk", 0),
        result.get("has_trustpilot", 0),
        result.get("has_sitejabber", 0),
        result.get("has_social_facebook", 0),
        result.get("has_social_instagram", 0),
        result.get("has_social_x", 0),
        result.get("has_social_youtube", 0),
        result.get("has_social_reddit", 0),
        result.get("has_website_reviews", 0),
        result.get("has_positive_reviews", 0),
        result.get("has_negative_reviews", 0),
        result.get("has_scam_report", 0),
        result.get("social_only_presence", 0),
    )
    return result


def calculate_final_score(
    ml_probability: float,
    company_name: str,
    website: str = None,
    features: Optional[Dict[str, int]] = None,
    reg: Optional[Dict] = None,
    rep: Optional[Dict[str, int]] = None,
) -> Dict:
    """
    Calculate final legitimacy score by combining:
    - ML model probability (40% weight)
    - Registration status (30% weight)
    - Online reputation (20% weight)
    - Website signals (10% weight)

    Pass precomputed `reg` / `rep` to avoid duplicate network lookups.
    """

    ml_score = ml_probability * 40
    logger.debug("[SCORING] company=%s ml_prob=%.4f", company_name, ml_probability)

    if reg is None:
        reg = check_lk_registration(company_name, website)
    if rep is None:
        rep = check_reputation(company_name, website)
    reg_score = 0
    reg_evidence: List[str] = []
    reg_notes: List[str] = []

    registration_status = reg.get("government_registration_status", "not_found")
    if registration_status == "registered":
        registration_status_label = "Officially registered"
    elif registration_status == "unverified":
        registration_status_label = "Unverified registration hint"
    else:
        registration_status_label = "Not confirmed"

    registration_summary = None

    if reg.get("is_cse_listed"):
        reg_score = max(reg_score, 30)
        reg_evidence.append("Listed on Colombo Stock Exchange (CSE)")
    if reg.get("is_boi_registered"):
        reg_score = max(reg_score, 25)
        reg_evidence.append("Registered with Board of Investment (BOI)")
    if reg.get("is_cbsl_licensed"):
        reg_score = max(reg_score, 25)
        reg_evidence.append("Licensed by Central Bank of Sri Lanka (CBSL)")
    if reg.get("is_ircsl_registered"):
        reg_score = max(reg_score, 25)
        reg_evidence.append("Registered with Insurance Regulatory Commission of Sri Lanka (IRCSL)")
    if reg.get("is_slaasmb_registered"):
        reg_score = max(reg_score, 25)
        sbe = reg.get("slaasmb_sbe_name") or reg.get("reg_name")
        label = "Listed as a Specified Business Enterprise (SLAASMB)"
        if sbe:
            label += f" — {sbe}"
        reg_evidence.append(label)
    if reg.get("is_drc_registered"):
        reg_score = max(reg_score, 20)
        sources = reg.get("registration_sources") or []
        if "opencorporates" in sources:
            label = "Found in OpenCorporates (Sri Lanka company registry)"
            if reg.get("reg_number"):
                label += f" — {reg.get('reg_number')}"
            reg_evidence.append(label)
        if any("eroc" in str(s).lower() for s in sources) or "drc_record" in sources:
            reg_evidence.append("Registered under Companies Act Sri Lanka (DRC / eROC)")
        elif "opencorporates" not in sources:
            reg_evidence.append("Registered under Companies Act Sri Lanka (DRC)")
    if reg.get("is_government_registered") and not reg_evidence:
        reg_score = max(reg_score, 15)
        reg_evidence.append("Registered with a Sri Lankan government authority")

    if not reg_evidence and registration_status != "registered":
        # Missing CSE/BOI is common for private SMEs — not automatic fraud.
        feats = features or {}
        scammy = int(feats.get("has_payment_risk") or 0) == 1 or int(
            feats.get("has_scam_report") or rep.get("has_scam_report") or 0
        ) == 1
        social_only = int(rep.get("social_only_presence") or feats.get("social_only_presence") or 0) == 1
        has_site = int(feats.get("has_https") or 0) == 1 or bool(website)
        has_pages = any(int(feats.get(k) or 0) == 1 for k in ("has_about", "has_contact", "has_privacy_policy"))
        has_social = any(
            int(rep.get(k) or feats.get(k) or 0) == 1
            for k in (
                "has_linkedin",
                "has_glassdoor",
                "has_indeed",
                "has_social_facebook",
                "has_social_instagram",
                "has_social_x",
                "has_social_youtube",
                "has_topjobs_lk",
            )
        )
        has_positive = int(rep.get("has_positive_reviews") or feats.get("has_positive_reviews") or 0) == 1
        # Social-only SMEs: presence via Facebook/Instagram/LinkedIn counts as business footprint
        has_presence = has_site or has_social or social_only
        sme_like = (
            (not scammy)
            and ml_probability >= 0.55
            and has_presence
            and (has_pages or has_social or has_positive or social_only)
        )

        if reg.get("government_registration_status") == "unverified":
            reg_score = 10
            reg_notes.append(
                "Sri Lanka registration hint found, but official registration was not confirmed"
            )
            registration_status = "unverified"
            registration_status_label = "Unverified registration hint"
        elif sme_like:
            reg_score = 12 if ml_probability >= 0.70 else 8
            reg_notes.append(
                "No CSE/BOI/CBSL listing found. Many legitimate private companies "
                "are only on DRC/eROC and may not appear in this online scan."
            )
            registration_status = "unverified"
            registration_status_label = "Not listed on CSE/BOI (common for SMEs)"
            registration_summary = (
                "Official public listing not confirmed. Business website/social/review signals "
                "look consistent, but ask for a company registration number to verify on eROC."
            )
        else:
            reg_evidence.append("No official Sri Lanka registration found in this scan")

    # De-dupe evidence lines while preserving order
    _seen_ev = set()
    reg_evidence = [e for e in reg_evidence if not (e in _seen_ev or _seen_ev.add(e))]
    if registration_status == "registered":
        registration_summary = (
            reg.get("government_registration_source")
            or reg.get("reg_source")
            or "Official Sri Lanka registration confirmed"
        )
    elif registration_status == "unverified":
        if not registration_summary:
            registration_summary = (
                "Sri Lanka registration was not fully confirmed online. "
                "Private companies often appear only on DRC/eROC."
            )
    else:
        registration_summary = "No official Sri Lanka registration found in this scan"

    logger.debug("[SCORING] registration_score=%.1f/30", reg_score)

    rep_score = 0
    rep_evidence: List[str] = []
    social_only = int(rep.get("social_only_presence") or 0) == 1
    # Social presence is worth more when it is the main public footprint
    social_points = 3 if social_only else 1

    if rep.get("has_glassdoor"):
        rep_score += 5
        rep_evidence.append("Found on Glassdoor")
    if rep.get("has_indeed"):
        rep_score += 5
        rep_evidence.append("Found on Indeed")
    if rep.get("has_linkedin"):
        rep_score += 5
        rep_evidence.append("Found on LinkedIn")
    if rep.get("has_topjobs_lk"):
        rep_score += 3
        rep_evidence.append("Listed on TopJobs.lk")
    if rep.get("has_ft_lk"):
        rep_score += 2
        rep_evidence.append("Mentioned in Daily FT (Sri Lanka)")
    if rep.get("has_trustpilot"):
        rep_score += 2
        rep_evidence.append("Found on Trustpilot")
    if rep.get("has_sitejabber"):
        rep_score += 2
        rep_evidence.append("Found on Sitejabber")
    if rep.get("has_ikman_lk"):
        rep_score += 2
        rep_evidence.append("Found on ikman.lk")
    if rep.get("has_social_facebook"):
        rep_score += social_points
        rep_evidence.append(
            "Active Facebook presence found" if social_only else "Facebook presence found"
        )
    if rep.get("has_social_instagram"):
        rep_score += social_points
        rep_evidence.append(
            "Active Instagram presence found" if social_only else "Instagram presence found"
        )
    if rep.get("has_social_x"):
        rep_score += social_points
        rep_evidence.append("X/Twitter presence found")
    if rep.get("has_social_youtube"):
        rep_score += social_points
        rep_evidence.append("YouTube presence found")
    if rep.get("has_social_reddit"):
        rep_score += 1
        rep_evidence.append("Reddit mentions found")
    if rep.get("has_website_reviews"):
        rep_score += 2
        rep_evidence.append("Page contains testimonials or reviews")
    if rep.get("has_positive_reviews"):
        rep_score += 4
        rep_evidence.append("Positive review / reputation signals found online")
    if rep.get("has_negative_reviews") and not rep.get("has_scam_report"):
        rep_score -= 4
        rep_evidence.append("Some negative review signals found online")
    if rep.get("has_scam_report"):
        rep_score -= 15
        rep_evidence.append("Scam reports found online")

    rep_score = max(0, min(20, rep_score))
    logger.debug("[SCORING] reputation_score=%.1f/20", rep_score)

    web_evidence: List[str] = []
    web_score = 0
    feats = features or {}

    # Prefer real website signals over ML-only thresholds (helps SMEs with real sites)
    if int(feats.get("has_https") or 0) == 1 and not social_only:
        web_score += 3
        web_evidence.append("Website uses HTTPS")
    if int(feats.get("has_about") or 0) == 1:
        web_score += 2
        web_evidence.append("About page found")
    if int(feats.get("has_contact") or 0) == 1:
        web_score += 2
        web_evidence.append("Contact page found")
    if int(feats.get("has_privacy_policy") or 0) == 1 or int(feats.get("has_terms") or 0) == 1:
        web_score += 2
        web_evidence.append("Privacy/Terms page found")
    if social_only and web_score == 0:
        # Social page is the public site — partial credit instead of zero
        web_score = 5 if (
            int(rep.get("has_social_facebook") or 0)
            or int(rep.get("has_social_instagram") or 0)
            or int(rep.get("has_linkedin") or 0)
        ) else 3
        web_evidence.append("Public presence is mainly social media (no separate website)")
    if int(feats.get("has_suspicious_tld") or 0) == 1 or int(feats.get("is_http_only") or 0) == 1:
        if not social_only:
            web_score = max(0, web_score - 2)
            web_evidence.append("Website has weak security signals")
    if int(feats.get("scrape_failed") or 0) == 1 and web_score == 0:
        web_evidence.append("Website could not be fully scanned")
    elif web_score == 0:
        # Fallback when feature flags missing
        if ml_probability > 0.6:
            web_score = 6
            web_evidence.append("Website signals inferred from model features")
        elif ml_probability > 0.4:
            web_score = 3
            web_evidence.append("Limited website signals")
        else:
            web_evidence.append("Weak or missing website signals")
    web_score = max(0, min(10, web_score))

    logger.debug("[SCORING] website_score=%.1f/10", web_score)

    # Feature-level evidence for frontend: positive/negative/unknown features
    FEATURE_LABELS = {
        "has_https": "HTTPS enabled",
        "is_http_only": "Only HTTP (no HTTPS)",
        "has_about": "Has About page",
        "has_contact": "Has Contact page",
        "has_privacy_policy": "Has Privacy Policy",
        "has_terms": "Has Terms & Conditions",
        "has_payment_risk": "Payment-risk indicators",
        "has_urgency_language": "Urgency language",
        "has_glassdoor": "Listed on Glassdoor",
        "has_indeed": "Listed on Indeed",
        "has_trustpilot": "Listed on Trustpilot",
        "has_linkedin": "LinkedIn presence",
        "has_topjobs_lk": "TopJobs.lk listing",
        "has_ft_lk": "Mentioned in Daily FT",
        "has_social_facebook": "Facebook presence",
        "has_social_instagram": "Instagram presence",
        "has_social_x": "X/Twitter presence",
        "has_social_youtube": "YouTube presence",
        "has_social_reddit": "Reddit presence",
        "has_website_reviews": "Reviews/testimonials",
        "has_positive_reviews": "Positive review signals",
        "has_negative_reviews": "Negative review signals",
        "social_only_presence": "Social-media-only presence",
        "has_scam_report": "Scam keywords detected",
        "scrape_failed": "Website scrape failed",
        "has_suspicious_tld": "Suspicious TLD",
        "email_type_encoded": "Email type (0=free,2=corporate)",
    }

    features_evidence = {}
    positive_features = []
    negative_features = []
    unknown_features = []
    # Merge reputation/social flags so the app always receives presence signals
    merged_feats = dict(features or {})
    for k in (
        "has_glassdoor",
        "has_indeed",
        "has_linkedin",
        "has_topjobs_lk",
        "has_ft_lk",
        "has_trustpilot",
        "has_sitejabber",
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
        if k in rep:
            merged_feats[k] = int(rep.get(k) or 0)

    if merged_feats:
        for k, v in merged_feats.items():
            label = FEATURE_LABELS.get(k, k)
            features_evidence[k] = {"value": v, "label": label}
            if v == 1:
                positive_features.append(label)
            elif v == 0:
                negative_features.append(label)
            else:
                unknown_features.append(label)

    final_score = ml_score + reg_score + rep_score + web_score
    final_score = max(0, min(100, final_score))
    logger.debug("[SCORING] final_score=%.1f/100", final_score)

    scam_hard = int((features or {}).get("has_payment_risk") or 0) == 1 or int(
        (features or {}).get("has_scam_report") or rep.get("has_scam_report") or 0
    ) == 1

    # Do not brand a likely-legit SME as "High fraud" only because CSE/BOI was missing
    # or because a flaky web search missed registration on a later retry.
    name_l = (company_name or "").lower()
    looks_registered_entity = any(
        tok in name_l for tok in ("pvt", "ltd", "limited", "plc", "private limited")
    )
    if (
        final_score < 45
        and (not scam_hard)
        and registration_status != "registered"
        and (
            ml_probability >= 0.65
            or (
                looks_registered_entity
                and ml_probability >= 0.45
                and (
                    bool(website)
                    or int((features or {}).get("has_https") or 0) == 1
                    or int(rep.get("has_positive_reviews") or 0) == 1
                    or int(rep.get("social_only_presence") or 0) == 1
                )
            )
        )
    ):
        final_score = max(final_score, 48)
        reg_notes.append(
            "Risk was capped at Medium: model leans legitimate / company-like name, but "
            "official registry could not be confirmed online this run "
            "(search results can vary; ask for an eROC registration number)."
        )

    if final_score >= 70:
        risk = "Low"
        verdict = "Likely Legitimate"
        color = "green"
    elif final_score >= 45:
        risk = "Medium"
        if registration_status != "registered":
            verdict = "Could not fully verify registration — proceed with caution"
        else:
            verdict = "Could not fully verify - proceed with caution"
        color = "orange"
    else:
        risk = "High"
        verdict = "High fraud risk detected"
        color = "red"

    recommendation = get_recommendation(risk, registration_status=registration_status)

    # Build human-friendly confidence reasons based on evidence
    confidence_reasons: List[str] = []

    # Strong positive registration reasons
    if reg_evidence and any(
        any(tok in s for tok in ["Registered", "Listed", "Licensed", "Colombo"]) for s in reg_evidence
    ):
        confidence_reasons.append("Official registration or listing found: " + ", ".join(reg_evidence))
    elif reg_notes:
        confidence_reasons.append(reg_notes[0])
    else:
        confidence_reasons.append(
            "No CSE/BOI/CBSL listing found in this scan (many private companies only appear on DRC/eROC)"
        )

    # Reputation signals
    if rep_evidence:
        scam_items = [s for s in rep_evidence if "Scam" in s or "scam" in s.lower()]
        if scam_items:
            confidence_reasons.append("Negative reputation signals: " + ", ".join(scam_items))
        else:
            confidence_reasons.append("Positive reputation signals: " + ", ".join(rep_evidence[:3]))
    else:
        confidence_reasons.append("No strong reputation signals found")

    # Website/feature signals summary
    if positive_features:
        confidence_reasons.append("Positive site/features: " + ", ".join(positive_features[:4]))
    if negative_features:
        confidence_reasons.append("Missing or negative site/features: " + ", ".join(negative_features[:4]))

    # Tailor final reason emphasis depending on risk level
    if risk == "Low":
        confidence_reasons = [r for r in confidence_reasons if not r.startswith("No authoritative")] + [r for r in confidence_reasons if r.startswith("No authoritative")]
    elif risk == "High":
        confidence_reasons = [r for r in confidence_reasons if r.startswith("Negative") or r.startswith("Missing")] + [r for r in confidence_reasons if not (r.startswith("Negative") or r.startswith("Missing"))]

    return {
        "verdict": verdict,
        "risk_level": risk,
        "legitimacy_score": round(final_score, 1),
        "color": color,
        "evidence": {
            "registration": reg_evidence,
            "registration_notes": reg_notes,
            "registration_status": registration_status,
            "registration_status_label": registration_status_label,
            "registration_summary": registration_summary,
            "registration_trace": reg.get("registration_trace", []),
            "government_registration_source": reg.get("government_registration_source"),
            "registration_sources": reg.get("registration_sources") or [],
            "registration_method": reg.get("registration_method"),
            "reg_name": reg.get("reg_name") or reg.get("cse_registered_name"),
            "reg_number": reg.get("reg_number"),
            "opencorporates_url": reg.get("opencorporates_url"),
            "slaasmb_sbe_name": reg.get("slaasmb_sbe_name"),
            "reputation": rep_evidence,
            "website": web_evidence,
            "features": features_evidence,
            "positive_features": positive_features,
            "negative_features": negative_features,
            "unknown_features": unknown_features,
        },
        "confidence_reasons": confidence_reasons,
        "contribution_details": {
            "registration": reg_evidence,
            "registration_notes": reg_notes,
            "registration_status": registration_status,
            "registration_status_label": registration_status_label,
            "registration_summary": registration_summary,
            "reputation": rep_evidence,
            "website": web_evidence,
            "features_positive": positive_features,
            "features_negative": negative_features,
        },
        "recommendation": recommendation,
        "score_breakdown": {
            "ml_score": round(ml_score, 1),
            "registration_score": round(reg_score, 1),
            "reputation_score": round(rep_score, 1),
            "website_score": round(web_score, 1),
        },
    }


def get_recommendation(risk: str, registration_status: str = "not_found") -> str:
    """Return recommendation text based on risk level."""
    if risk == "Low":
        return "Company appears legitimate. Safe to apply through official channels."
    if risk == "Medium":
        if registration_status != "registered":
            return (
                "Could not confirm CSE/BOI listing. Many genuine private companies are only on "
                "DRC/eROC — ask for a registration number and verify before sharing personal info."
            )
        return (
            "Could not fully verify. Check the company on topjobs.lk, LinkedIn, "
            "or call their office before sharing personal info."
        )
    return (
        "Strong fraud indicators detected. Do not pay any fees, share financial "
        "information, or submit personal documents."
    )
