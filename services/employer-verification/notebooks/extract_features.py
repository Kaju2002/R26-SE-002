"""
STEP 2 — extract_features.py
Extracts additional features from each company website AND reviews.

Features extracted:
  Website features:
    - has_https, domain_age_days, has_privacy_policy, has_terms
    - has_payment_risk, has_urgency_language
    - email_type, content_score, is_registered

  Review features (via review_extractor.py):
    - review_score, review_count
    - has_glassdoor, has_indeed, has_trustpilot
    - has_negative_reviews, has_positive_reviews

Run AFTER clean_urls.py.

Usage:
    python src/preprocessing/extract_features.py

Install deps first:
    pip install requests beautifulsoup4 python-whois textstat duckduckgo-search
"""

import os
import re
import sys
import time
import pandas as pd
import requests
import textstat
import whois
from bs4 import BeautifulSoup
from datetime import datetime

# ── Import review extractor ────────────────────────────────────────────────
sys.path.append(os.path.dirname(__file__))
from review_extractor import get_review_features

# ── Paths ──────────────────────────────────────────────────────────────────
INPUT      = "data/processed/feature_dataset_cleaned.csv"
OUTPUT     = "data/processed/feature_dataset_v2.csv"
CHECKPOINT = "data/processed/_checkpoint_v2.csv"

# ── Config ─────────────────────────────────────────────────────────────────
REQUEST_TIMEOUT  = 10
SLEEP_WEBSITE    = 1.5    # delay after each website scrape
SLEEP_REVIEW     = 2.0    # delay after review search (heavier queries)
SAVE_EVERY       = 50     # checkpoint every N rows

# ── Keywords ───────────────────────────────────────────────────────────────
PAYMENT_KEYWORDS = [
    "cryptocurrency", "bitcoin", "btc", "usdt", "wire transfer",
    "western union", "moneygram", "cash app", "send money first",
    "pay to apply", "payoneer advance",
]

URGENCY_KEYWORDS = [
    "act now", "limited time", "urgent", "hurry", "expires soon",
    "don't miss", "apply immediately", "today only", "last chance",
    "seats are limited", "only a few spots",
]

FREE_EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "protonmail.com", "icloud.com", "ymail.com",
]

REGISTERED_TLDS   = [".lk", ".gov.lk", ".edu.lk", ".org.lk", ".com"]
UNREGISTERED_TLDS = [".xyz", ".club", ".biz", ".info", ".site", ".online", ".io"]


# ── Website feature helpers ────────────────────────────────────────────────

def get_domain_age(url: str):
    try:
        domain = url.replace("https://", "").replace("http://", "").split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]
        w = whois.whois(domain)
        created = w.creation_date
        if isinstance(created, list):
            created = created[0]
        if created and isinstance(created, datetime):
            return (datetime.now() - created).days
    except Exception:
        pass
    return None


def extract_website_features(url: str) -> dict:
    features = {
        "has_https"           : 0,
        "domain_age_days"     : None,
        "has_privacy_policy"  : 0,
        "has_terms"           : 0,
        "has_payment_risk"    : 0,
        "has_urgency_language": 0,
        "email_type"          : "unknown",
        "content_score"       : 0.0,
        "is_registered"       : 0,
    }

    if not url or str(url) == "nan":
        return features

    url = str(url).strip()
    features["has_https"] = 1 if url.startswith("https://") else 0
    features["domain_age_days"] = get_domain_age(url)

    lower_url = url.lower()
    if any(t in lower_url for t in REGISTERED_TLDS):
        features["is_registered"] = 1
    elif any(t in lower_url for t in UNREGISTERED_TLDS):
        features["is_registered"] = 0
    else:
        features["is_registered"] = 1

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }
        resp = requests.get(url, timeout=REQUEST_TIMEOUT, headers=headers)
        soup = BeautifulSoup(resp.text, "html.parser")
        text = soup.get_text(separator=" ").lower()

        features["has_privacy_policy"] = 1 if "privacy policy" in text else 0
        features["has_terms"] = (
            1 if any(t in text for t in
                     ["terms and conditions", "terms of service", "terms of use"])
            else 0
        )
        features["has_payment_risk"] = (
            1 if any(k in text for k in PAYMENT_KEYWORDS) else 0
        )
        features["has_urgency_language"] = (
            1 if any(k in text for k in URGENCY_KEYWORDS) else 0
        )

        emails = re.findall(
            r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
            resp.text
        )
        if emails:
            first_email = emails[0].lower()
            features["email_type"] = (
                "free" if any(fd in first_email for fd in FREE_EMAIL_DOMAINS)
                else "company"
            )

        plain = " ".join(soup.get_text().split())[:3000]
        if plain:
            score = textstat.flesch_reading_ease(plain)
        if score < 0 or score > 100:
            score = 0
        features["content_score"] = round(score, 2)

    except Exception:
        pass

    return features


# ── Defaults for fake/synthetic companies ─────────────────────────────────

# ⚠️  REMOVED: scam_website_defaults() and scam_review_defaults()
# LEAKAGE FIX: No more label-based synthetic defaults.
# All rows are now scraped uniformly. Missing data becomes NaN,
# and build_dataset.py handles global imputation (not per-label).


# ── All new columns ────────────────────────────────────────────────────────

NEW_COLS = [
    # Website
    "has_https", "domain_age_days", "has_privacy_policy", "has_terms",
    "has_payment_risk", "has_urgency_language", "email_type",
    "content_score", "is_registered",
    # Reviews
    "review_score", "review_count",
    "has_glassdoor", "has_indeed", "has_trustpilot",
    "has_topjobs_lk", "has_ikman_lk", "has_ft_lk",
    "has_cse_boi_mention", "lk_platform_presence",
    "has_negative_reviews", "has_positive_reviews",
]


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    os.makedirs("data/processed", exist_ok=True)

    # Resume from checkpoint if available
    if os.path.exists(CHECKPOINT):
        print(f"♻️  Resuming from checkpoint: {CHECKPOINT}")
        df = pd.read_csv(CHECKPOINT)
        if "has_https" in df.columns:
            unprocessed = df[df["has_https"].isna()].index
            start_idx = int(unprocessed.min()) if len(unprocessed) > 0 else len(df)
        else:
            start_idx = 0
    else:
        print(f"Loading : {INPUT}")
        df = pd.read_csv(INPUT)
        for col in NEW_COLS:
            df[col] = None
        start_idx = 0

    total = len(df)
    print(f"Total rows  : {total}")
    print(f"Start index : {start_idx}\n")

    for i in range(start_idx, total):
        row     = df.iloc[i]
        url     = str(row.get("website_url", "") or "")
        company = str(row.get("company_name", ""))
        label   = row.get("label", -1)

        tag = "[LEGIT]" if label == 1 else "[FAKE] "
        print(f"\n[{i+1}/{total}] {tag} {company[:55]}")

        # ── LEAKAGE FIX: SCRAPE ALL ROWS UNIFORMLY ────────────────────────────
        # No more label-based branching. Whether fake or legit, extract real data.
        # Missing data → NaN, which build_dataset.py imputes globally (not per-label)

        # 1. Website features
        print(f"         Scraping : {url[:65]}")
        web_feats = extract_website_features(url)
        for col, val in web_feats.items():
            df.at[i, col] = val
        print(f"         https={web_feats['has_https']}  "
              f"age={web_feats['domain_age_days']}d  "
              f"policy={web_feats['has_privacy_policy']}  "
              f"terms={web_feats['has_terms']}  "
              f"email={web_feats['email_type']}  "
              f"readability={web_feats['content_score']}")
        time.sleep(SLEEP_WEBSITE)

        # 2. Review features
        print(f"         Reviews  : {company[:55]}")
        review_feats = get_review_features(company)
        for col, val in review_feats.items():
            df.at[i, col] = val
        print(f"         score={review_feats['review_score']}  "
              f"results={review_feats['review_count']}  "
              f"glassdoor={review_feats['has_glassdoor']}  "
              f"indeed={review_feats['has_indeed']}  "
              f"negative={review_feats['has_negative_reviews']}  "
              f"positive={review_feats['has_positive_reviews']}")
        time.sleep(SLEEP_REVIEW)

        # ── Save checkpoint ────────────────────────────────────────────────
        if (i + 1) % SAVE_EVERY == 0:
            df.to_csv(CHECKPOINT, index=False)
            print(f"\n  💾 Checkpoint saved at row {i+1}/{total}")

    # ── Final save ─────────────────────────────────────────────────────────
    df.to_csv(OUTPUT, index=False)
    print(f"\n{'='*55}")
    print(f" DONE — Saved → {OUTPUT}")
    print(f"   Total rows         : {len(df)}")
    print(f"   Legit (1)          : {(df['label']==1).sum()}")
    print(f"   Fake  (0)          : {(df['label']==0).sum()}")
    print(f"   Missing domain age : {df['domain_age_days'].isna().sum()}")
    print(f"   Avg review score   : {df['review_score'].mean():.2f}")

    if os.path.exists(CHECKPOINT):
        os.remove(CHECKPOINT)
        print("   Checkpoint removed.")


if __name__ == "__main__":
    main()