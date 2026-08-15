"""Prepare a training-dataset-format CSV from collected employer samples.

This script reads a source CSV that contains at least:
    company_name, website_url, label

and enriches each row into the same schema used by the training pipeline:
    website_alive, valid_website, has_about, has_contact, subdomain_count,
    domain_length, content_length, scam_score, has_https, domain_age_days,
    has_privacy_policy, has_terms, has_payment_risk, has_urgency_language,
    content_score, is_registered, review_score, review_count, has_glassdoor,
    has_indeed, has_trustpilot, has_negative_reviews, has_positive_reviews,
    email_type_encoded, has_suspicious_tld, is_http_only, trust_score,
    suspicion_score.

The output is ready to be merged later with a second file of fake companies
and then used as the final training dataset.

Usage:
    python notebooks/prepare_training_dataset.py --input-csv data/new_dataset_v1.csv
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import pandas as pd
import requests
from bs4 import BeautifulSoup


NOTEBOOKS_ROOT = Path(__file__).resolve().parent
SERVICE_ROOT = NOTEBOOKS_ROOT.parent

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.employer_verification_model.registration_utils import check_registration_status  # type: ignore

try:
    from review_extractor import get_review_features  # type: ignore
except Exception:
    def get_review_features(company_name: str) -> dict:
        return {
            "review_score": 0.5,
            "review_count": 0,
            "has_glassdoor": 0,
            "has_indeed": 0,
            "has_trustpilot": 0,
            "has_negative_reviews": 0,
            "has_positive_reviews": 0,
        }


INPUT_DEFAULT = SERVICE_ROOT / "data" / "new_dataset_v1.csv"
OUTPUT_DEFAULT = SERVICE_ROOT / "data" / "final" / "training_dataset.csv"

REQUEST_TIMEOUT = 10
SUSPICIOUS_TLDS = [".xyz", ".club", ".biz", ".online", ".site", ".info", ".io"]
PAYMENT_KEYWORDS = [
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
URGENCY_KEYWORDS = [
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
FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com", "icloud.com", "ymail.com"]

TARGET_COLUMNS = [
    "company_name",
    "website_url",
    "label",
    "website_alive",
    "valid_website",
    "has_about",
    "has_contact",
    "subdomain_count",
    "domain_length",
    "content_length",
    "scam_score",
    "has_https",
    "domain_age_days",
    "has_privacy_policy",
    "has_terms",
    "has_payment_risk",
    "has_urgency_language",
    "content_score",
    "is_registered",
    "review_score",
    "review_count",
    "has_glassdoor",
    "has_indeed",
    "has_trustpilot",
    "has_negative_reviews",
    "has_positive_reviews",
    "email_type_encoded",
    "has_suspicious_tld",
    "is_http_only",
    "trust_score",
    "suspicion_score",
]


def get_domain_age(url: str) -> int | None:
    try:
        import whois

        domain = url.replace("https://", "").replace("http://", "").split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]
        record = whois.whois(domain)
        created = record.creation_date
        if isinstance(created, list):
            created = created[0]
        if created and isinstance(created, datetime):
            return (datetime.now() - created).days
    except Exception:
        pass
    return None


def _normalize_label(value: object) -> int:
    if pd.isna(value):
        return 0

    text = str(value).strip().lower()
    if text in {"1", "legit", "legitimate", "true", "yes"}:
        return 1
    if text in {"0", "fake", "fraud", "fraudulent", "scam", "no"}:
        return 0

    try:
        return 1 if float(value) == 1.0 else 0
    except Exception:
        return 0


def _clean_url(url: object) -> str:
    if pd.isna(url):
        return ""

    text = str(url).strip()
    if not text:
        return ""

    text = re.sub(r"^([a-z]+);/?/?", r"\1://", text, flags=re.IGNORECASE)
    if not re.match(r"^[a-z]+://", text, re.IGNORECASE):
        text = "http://" + text
    return text


def _domain_info(url: str) -> tuple[str, int, int]:
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    domain_length = len(domain)
    subdomain_count = domain.count(".")
    return domain, domain_length, subdomain_count


def _safe_get(url: str) -> requests.Response | None:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT, headers=headers)
        return response
    except Exception:
        return None


def _scrape_website(url: str) -> dict:
    features = {
        "website_alive": 0,
        "valid_website": 0,
        "has_about": 0,
        "has_contact": 0,
        "content_length": 0,
        "scam_score": 0,
        "has_https": 0,
        "domain_age_days": np.nan,
        "has_privacy_policy": 0,
        "has_terms": 0,
        "has_payment_risk": 0,
        "has_urgency_language": 0,
        "content_score": 0.0,
        "email_type_encoded": 1,
        "has_suspicious_tld": 0,
        "is_http_only": 0,
    }

    if not url:
        return features

    domain, _, _ = _domain_info(url)
    lower_url = url.lower()
    features["has_https"] = 1 if lower_url.startswith("https://") else 0
    features["has_suspicious_tld"] = 1 if any(tld in lower_url for tld in SUSPICIOUS_TLDS) else 0
    features["is_http_only"] = 1 if features["has_https"] == 0 else 0

    try:
        features["domain_age_days"] = get_domain_age(url)
    except Exception:
        features["domain_age_days"] = np.nan

    response = _safe_get(url)
    if response is None:
        return features

    features["website_alive"] = 1 if response.status_code < 400 else 0
    features["valid_website"] = 1 if response.status_code < 500 and domain else 0

    try:
        soup = BeautifulSoup(response.text, "html.parser")
        visible_text = " ".join(soup.get_text(" ").split()).lower()
        raw_html = response.text.lower()

        features["content_length"] = len(visible_text)
        features["has_about"] = 1 if "about us" in visible_text or "about" in visible_text else 0
        features["has_contact"] = 1 if "contact us" in visible_text or "contact" in visible_text else 0
        features["has_privacy_policy"] = 1 if "privacy policy" in visible_text or "privacy" in visible_text else 0
        features["has_terms"] = 1 if any(token in visible_text for token in ["terms and conditions", "terms of service", "terms of use", "terms"]) else 0
        features["has_payment_risk"] = 1 if any(keyword in visible_text for keyword in PAYMENT_KEYWORDS) else 0
        features["has_urgency_language"] = 1 if any(keyword in visible_text for keyword in URGENCY_KEYWORDS) else 0
        features["scam_score"] = sum(1 for keyword in PAYMENT_KEYWORDS + URGENCY_KEYWORDS if keyword in visible_text)

        text_score = len(visible_text)
        features["content_score"] = float(min(100.0, max(0.0, text_score / 40.0))) if text_score else 0.0

        emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", raw_html)
        if emails:
            first_email = emails[0].lower()
            features["email_type_encoded"] = 0 if any(domain in first_email for domain in FREE_EMAIL_DOMAINS) else 2

    except Exception:
        pass

    return features


def _derive_registry_features(company_name: str, website_url: str) -> dict:
    registry = check_registration_status(company_name, website_url or None)
    is_registered = 1 if any(
        int(registry.get(flag, 0) or 0)
        for flag in [
            "is_cse_listed",
            "is_boi_registered",
            "is_cbsl_licensed",
            "is_drc_registered",
            "is_ircsl_registered",
            "is_slaasmb_registered",
            "is_government_registered",
        ]
    ) else 0
    return {"is_registered": is_registered}


def _derive_review_features(company_name: str) -> dict:
    review = get_review_features(company_name)
    return {
        "review_score": review.get("review_score", 0.5),
        "review_count": review.get("review_count", 0),
        "has_glassdoor": review.get("has_glassdoor", 0),
        "has_indeed": review.get("has_indeed", 0),
        "has_trustpilot": review.get("has_trustpilot", 0),
        "has_negative_reviews": review.get("has_negative_reviews", 0),
        "has_positive_reviews": review.get("has_positive_reviews", 0),
    }


def _build_derived_scores(df: pd.DataFrame) -> pd.DataFrame:
    df["trust_score"] = df[
        [
            c
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
                "has_positive_reviews",
            ]
            if c in df.columns
        ]
    ].sum(axis=1)
    df["suspicion_score"] = df[
        [
            c
            for c in [
                "has_payment_risk",
                "has_urgency_language",
                "has_suspicious_tld",
                "is_http_only",
                "has_negative_reviews",
            ]
            if c in df.columns
        ]
    ].sum(axis=1)
    return df


def enrich_dataset(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    total = len(df)

    for index, row in df.iterrows():
        company_name = str(row.get("company_name", "") or "").strip()
        website_url = _clean_url(row.get("website_url", ""))
        label = _normalize_label(row.get("label", 0))

        website_features = _scrape_website(website_url)
        registry_features = _derive_registry_features(company_name, website_url)
        review_features = _derive_review_features(company_name)
        _, domain_length, subdomain_count = _domain_info(website_url) if website_url else ("", 0, 0)

        enriched = {
            "company_name": company_name,
            "website_url": website_url,
            "label": label,
            "domain_length": domain_length,
            "subdomain_count": subdomain_count,
        }
        enriched.update(website_features)
        enriched.update(registry_features)
        enriched.update(review_features)
        rows.append(enriched)

        print(f"[{index + 1}/{total}] {company_name[:60]} -> label={label} registry={registry_features['is_registered']}")

    enriched_df = pd.DataFrame(rows)
    enriched_df = _build_derived_scores(enriched_df)
    if "domain_age_days" in enriched_df.columns:
        enriched_df["domain_age_days"] = pd.to_numeric(enriched_df["domain_age_days"], errors="coerce").fillna(0)

    for column_name in TARGET_COLUMNS:
        if column_name not in enriched_df.columns:
            enriched_df[column_name] = 0

    return enriched_df[TARGET_COLUMNS].copy()


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich employer collection data into the training dataset format")
    parser.add_argument("--input-csv", type=Path, default=INPUT_DEFAULT, help="Source CSV with company_name, website_url, label")
    parser.add_argument("--output-csv", type=Path, default=OUTPUT_DEFAULT, help="Output CSV in training_dataset format")
    args = parser.parse_args()

    if not args.input_csv.exists():
        raise SystemExit(f"Input CSV not found: {args.input_csv}")

    source_df = pd.read_csv(args.input_csv)
    required_columns = {"company_name", "website_url", "label"}
    missing = sorted(required_columns - set(source_df.columns))
    if missing:
        raise SystemExit(f"Missing required columns: {missing}")

    print(f"Loading source: {args.input_csv}")
    print(f"Rows: {len(source_df)}")

    enriched_df = enrich_dataset(source_df)

    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    enriched_df.to_csv(args.output_csv, index=False)

    print("\nFinal report")
    print("============")
    print(f"Saved: {args.output_csv}")
    print(f"Rows : {len(enriched_df)}")
    print(f"Legit: {(enriched_df['label'] == 1).sum()}")
    print(f"Fake : {(enriched_df['label'] == 0).sum()}")
    print(f"NaNs : {enriched_df.isna().sum().sum()}")


if __name__ == "__main__":
    main()