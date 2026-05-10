"""
Rule-based scoring layer for employer verification.
Combines ML model output with registration and reputation checks.
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError, as_completed
from typing import Dict, Iterable, List, Tuple, Optional
from urllib.parse import quote_plus, urlparse

import requests
from app.employer_verification_model.registration_utils import check_registration_status

logger = logging.getLogger(__name__)


def _normalize_url(url: str) -> str:
    """Normalize URL to handle common malformations.
    
    Examples:
    - 'https;//example.com' -> 'https://example.com'
    - 'http;example.com' -> 'http://example.com'
    - 'example.com' -> 'http://example.com'
    """
    if not url:
        return url
    
    url = url.strip()
    
    # Fix semicolons in scheme (e.g., https;// -> https://, http;// -> http://)
    # Handle both https;// and http; patterns
    url = re.sub(r'^([a-z]+);/?/?', r'\1://', url, flags=re.IGNORECASE)
    
    # Ensure URL has a scheme
    if not re.match(r'^[a-z]+://', url, re.IGNORECASE):
        url = 'http://' + url
    
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
        f'{company_name} Sri Lanka {suffix}',
    ]


def _website_reputation_signals(website: str) -> Dict[str, int]:
    """Inspect the official website for testimonials, reviews, and social links."""
    signals = {
        "has_glassdoor": 0,
        "has_indeed": 0,
        "has_linkedin": 0,
        "has_topjobs_lk": 0,
        "has_ft_lk": 0,
        "has_trustpilot": 0,
        "has_sitejabber": 0,
        "has_website_reviews": 0,
        "has_social_facebook": 0,
        "has_social_instagram": 0,
        "has_social_x": 0,
        "has_social_youtube": 0,
        "has_social_reddit": 0,
    }

    if not website:
        return signals

    # Normalize URL to handle common malformations (e.g., https;// -> https://)
    normalized_url = _normalize_url(website)
    
    try:
        response = requests.get(normalized_url, timeout=6, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        html = response.text.lower()
    except Exception as exc:
        logger.debug("[WEB] website check failed for %s: %s", website, str(exc)[:140])
        return signals

    review_terms = [
        "testimonial",
        "testimonials",
        "review",
        "reviews",
        "rating",
        "ratings",
        "feedback",
        "what our clients say",
        "client says",
    ]
    if any(term in html for term in review_terms):
        signals["has_website_reviews"] = 1

    social_markers = {
        "has_social_facebook": ["facebook.com"],
        "has_social_instagram": ["instagram.com"],
        "has_social_x": ["x.com", "twitter.com"],
        "has_social_youtube": ["youtube.com"],
        "has_social_reddit": ["reddit.com"],
    }

    platform_markers = {
        "has_glassdoor": ["glassdoor.com"],
        "has_indeed": ["indeed.com"],
        "has_linkedin": ["linkedin.com/company", "linkedin.com/in/"],
        "has_topjobs_lk": ["topjobs.lk"],
        "has_ft_lk": ["ft.lk"],
        "has_trustpilot": ["trustpilot.com"],
        "has_sitejabber": ["sitejabber.com"],
    }

    for key, markers in social_markers.items():
        if any(marker in html for marker in markers):
            signals[key] = 1

    for key, markers in platform_markers.items():
        if any(marker in html for marker in markers):
            signals[key] = 1

    return signals


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
    Check company's online reputation and presence (with timeout).
    Looks for:
    - Job platform presence (Glassdoor, Indeed, LinkedIn, TopJobs.lk)
    - Review platforms (Trustpilot, Sitejabber)
    - Official website testimonials/reviews
    - Social media presence (Facebook, Instagram, X, YouTube, Reddit)
    - Sri Lanka business news mentions (Daily FT)
    - Scam reports (keyword search)
    """
    logger.debug("[REP] Checking %s", company_name)

    # Fast-track allowlist is a fallback, not the primary source.
    allowlist_key = company_name.lower()
    result = {
        "has_glassdoor": 0,
        "has_indeed": 0,
        "has_linkedin": 0,
        "has_topjobs_lk": 0,
        "has_ft_lk": 0,
        "has_trustpilot": 0,
        "has_sitejabber": 0,
        "has_social_facebook": 0,
        "has_social_instagram": 0,
        "has_social_x": 0,
        "has_social_youtube": 0,
        "has_social_reddit": 0,
        "has_website_reviews": 0,
        "has_scam_report": 0,
    }

    result.update(_website_reputation_signals(website))

    if any(keyword in (company_name or "").lower() for keyword in ["scam", "fake", "fraud", "easy money", "holdings"]):
        result["has_scam_report"] = 1
        logger.debug("[REP] scam keyword detected in company name")

    logger.debug(
        "[REP] result glassdoor=%s indeed=%s linkedin=%s topjobs=%s ft=%s trustpilot=%s sitejabber=%s fb=%s ig=%s x=%s yt=%s reddit=%s web_reviews=%s scam=%s",
        result["has_glassdoor"],
        result["has_indeed"],
        result["has_linkedin"],
        result["has_topjobs_lk"],
        result["has_ft_lk"],
        result.get("has_trustpilot", 0),
        result.get("has_sitejabber", 0),
        result.get("has_social_facebook", 0),
        result.get("has_social_instagram", 0),
        result.get("has_social_x", 0),
        result.get("has_social_youtube", 0),
        result.get("has_social_reddit", 0),
        result.get("has_website_reviews", 0),
        result["has_scam_report"],
    )
    return result


def calculate_final_score(
    ml_probability: float,
    company_name: str,
    website: str = None,
    features: Optional[Dict[str, int]] = None,
) -> Dict:
    """
    Calculate final legitimacy score by combining:
    - ML model probability (40% weight)
    - Registration status (30% weight)
    - Online reputation (20% weight)
    - Website signals (10% weight)

    Returns dict with verdict, risk_level, legitimacy_score, color, and evidence.
    """

    ml_score = ml_probability * 40
    logger.debug("[SCORING] company=%s ml_prob=%.4f", company_name, ml_probability)

    reg = check_lk_registration(company_name, website)
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

    if reg.get("is_cse_listed"):
        reg_score += 30
        reg_evidence.append("Listed on Colombo Stock Exchange (CSE)")
    elif reg.get("is_boi_registered"):
        reg_score += 25
        reg_evidence.append("Registered with Board of Investment (BOI)")
    elif reg.get("is_cbsl_licensed") or reg.get("is_ircsl_registered") or reg.get("is_slaasmb_registered"):
        reg_score += 25
        if reg.get("is_cbsl_licensed"):
            reg_evidence.append("Licensed by Central Bank of Sri Lanka (CBSL)")
        elif reg.get("is_ircsl_registered"):
            reg_evidence.append("Registered with Insurance Regulatory Commission of Sri Lanka (IRCSL)")
        else:
            reg_evidence.append("Registered with Sri Lanka Accounting and Auditing Standards Monitoring Board (SLAASMB)")
    elif reg.get("is_drc_registered"):
        reg_score += 20
        reg_evidence.append("Registered under Companies Act Sri Lanka (DRC)")
    elif reg.get("is_government_registered"):
        reg_score += 15
        reg_evidence.append("Registered with a Sri Lankan government authority")
    else:
        if reg.get("government_registration_status") == "unverified":
            reg_notes.append("Sri Lanka registration hint found, but official registration was not confirmed")
        else:
            reg_evidence.append("No official Sri Lanka registration found")

    if registration_status == "registered":
        registration_summary = reg.get("government_registration_source") or reg.get("reg_source") or "Official Sri Lanka registration confirmed"
    elif registration_status == "unverified":
        registration_summary = "Sri Lanka registration hint found, but official confirmation was not available"
    else:
        registration_summary = "No official Sri Lanka registration found"

    logger.debug("[SCORING] registration_score=%.1f/30", reg_score)

    rep = check_reputation(company_name, website)
    rep_score = 0
    rep_evidence: List[str] = []

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
    if rep.get("has_social_facebook"):
        rep_score += 1
        rep_evidence.append("Official site links to Facebook")
    if rep.get("has_social_instagram"):
        rep_score += 1
        rep_evidence.append("Official site links to Instagram")
    if rep.get("has_social_x"):
        rep_score += 1
        rep_evidence.append("Official site links to X/Twitter")
    if rep.get("has_social_youtube"):
        rep_score += 1
        rep_evidence.append("Official site links to YouTube")
    if rep.get("has_social_reddit"):
        rep_score += 1
        rep_evidence.append("Official site links to Reddit")
    if rep.get("has_website_reviews"):
        rep_score += 2
        rep_evidence.append("Website contains testimonials or reviews")
    if rep.get("has_scam_report"):
        rep_score -= 15
        rep_evidence.append("Scam reports found online")

    rep_score = max(0, min(20, rep_score))
    logger.debug("[SCORING] reputation_score=%.1f/20", rep_score)

    web_evidence: List[str] = []
    web_score = 0
    if ml_probability > 0.6:
        web_score = 10
        web_evidence.append("Website structure appears professional")
    elif ml_probability > 0.4:
        web_score = 5
        web_evidence.append("Website partially verified")
    else:
        web_evidence.append("Website shows suspicious signals")

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
        "has_social_facebook": "Facebook link",
        "has_social_instagram": "Instagram link",
        "has_social_x": "X/Twitter link",
        "has_social_youtube": "YouTube link",
        "has_social_reddit": "Reddit link",
        "has_website_reviews": "Website reviews/testimonials",
        "has_scam_report": "Scam keywords detected",
        "scrape_failed": "Website scrape failed",
        "has_suspicious_tld": "Suspicious TLD",
        "email_type_encoded": "Email type (0=free,2=corporate)",
    }

    features_evidence = {}
    positive_features = []
    negative_features = []
    unknown_features = []
    if features:
        for k, v in features.items():
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

    if final_score >= 70:
        risk = "Low"
        verdict = "Likely Legitimate"
        color = "green"
    elif final_score >= 45:
        risk = "Medium"
        verdict = "Could not fully verify - proceed with caution"
        color = "orange"
    else:
        risk = "High"
        verdict = "High fraud risk detected"
        color = "red"

    recommendation = get_recommendation(risk)

    # Build human-friendly confidence reasons based on evidence
    confidence_reasons: List[str] = []

    # Strong positive registration reasons
    if reg_evidence and any(
        any(tok in s for tok in ["Registered", "Listed", "Licensed", "Colombo"]) for s in reg_evidence
    ):
        confidence_reasons.append("Official registration or listing found: " + ", ".join(reg_evidence))
    else:
        confidence_reasons.append("No authoritative Sri Lanka registration found")

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


def get_recommendation(risk: str) -> str:
    """Return recommendation text based on risk level."""
    if risk == "Low":
        return "Company appears legitimate. Safe to apply."
    if risk == "Medium":
        return (
            "Could not fully verify registration. Check the company on topjobs.lk, "
            "LinkedIn, or call their office before sharing personal info."
        )
    return (
        "Strong fraud indicators detected. Do not pay any fees, share financial "
        "information, or submit personal documents."
    )
