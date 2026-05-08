"""
STEP 1 — clean_urls.py
Removes clearly wrong URLs from legitimate companies.
Run this first before any feature extraction.

Usage:
    python src/preprocessing/clean_urls.py
"""

import pandas as pd
import os

# ── Paths ──────────────────────────────────────────────────────────────────
INPUT  = "data/raw/feature_dataset.csv"
OUTPUT = "data/processed/feature_dataset_cleaned.csv"

# ── Domains that are clearly wrong for a legitimate Sri Lankan company ─────
BAD_DOMAINS_FOR_LEGIT = [
    # Social / video
    "tiktok.com", "youtube.com", "facebook.com", "instagram.com",
    "twitter.com", "linkedin.com",
    # Finance / stock data aggregators (not the company's own site)
    "investing.com", "tradingview.com", "emis.com", "patsnap.com",
    "worldatlas.com", "bloomberg.com", "reuters.com",
    # Sri Lankan news sites
    "ft.lk", "adaderana.lk", "dailymirror.lk", "sundaytimes.lk",
    "newsfirst.lk", "bizenglish.adaderana.lk",
    # Government portals (not the company site)
    "gov.lk", "cbsl.gov.lk", "sec.gov.lk",
    # Airline / travel portals (wrong company)
    "srilankan.com",
    # E-commerce / marketplaces
    "alibaba.com", "amazon.com",
    # Property listing sites
    "lankapropertyweb.com",
    # Other generic portals
    "branches.lk",
]


def is_wrong_url(row: pd.Series) -> bool:
    """Return True if the URL is clearly wrong for a legitimate company."""
    if row["label"] != 1:
        return False                          # only check legit rows
    url = str(row.get("website_url", "") or "")
    if not url or url == "nan":
        return False
    return any(bad in url for bad in BAD_DOMAINS_FOR_LEGIT)


def main():
    os.makedirs("data/processed", exist_ok=True)

    print(f"Loading  : {INPUT}")
    df = pd.read_csv(INPUT)
    print(f"Rows     : {len(df)}")
    print(f"Columns  : {df.columns.tolist()}\n")

    # ── Find and clear wrong URLs ──────────────────────────────────────────
    wrong_mask = df.apply(is_wrong_url, axis=1)
    print(f"Wrong URLs found in legit rows : {wrong_mask.sum()}")

    if wrong_mask.sum() > 0:
        print("\nSample wrong URLs being cleared:")
        sample = df[wrong_mask][["company_name", "website_url"]].head(10)
        for _, r in sample.iterrows():
            print(f"  {r['company_name'][:45]:<45} → {r['website_url']}")

    # Clear wrong URLs (set to None so feature extractor skips them)
    df.loc[wrong_mask, "website_url"]   = None
    df.loc[wrong_mask, "website_alive"] = 0
    df.loc[wrong_mask, "valid_website"] = 0

    # ── Also clear obviously irrelevant scam-company URLs that are alive ───
    # (synthetic scam URLs are dead — but some may have resolved elsewhere)
    # No action needed here; scam rows stay as-is.

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\nAfter cleaning:")
    print(f"  Total rows      : {len(df)}")
    print(f"  Legit (1)       : {(df['label']==1).sum()}")
    print(f"  Fake  (0)       : {(df['label']==0).sum()}")
    print(f"  Missing URLs    : {df['website_url'].isna().sum()}")

    df.to_csv(OUTPUT, index=False)
    print(f"\n✅ Saved → {OUTPUT}")


if __name__ == "__main__":
    main()