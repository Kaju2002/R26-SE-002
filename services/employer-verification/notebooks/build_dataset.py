"""
STEP 3 — build_dataset.py
Merges all features, fills missing values, encodes categoricals,
and outputs the final training-ready CSV.

Run AFTER extract_features.py.

Usage:
    python src/preprocessing/build_dataset.py
"""

import os
import pandas as pd
import numpy as np

# ── Paths ──────────────────────────────────────────────────────────────────
INPUT  = "data/processed/feature_dataset_v2.csv"
OUTPUT = "data/final/training_dataset.csv"


# ── Fill missing values ────────────────────────────────────────────────────
# ⚠️  CRITICAL FIX: Use GLOBAL imputation, never label-based
# Label-based imputation leaks the target variable into features.

def fill_missing(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fill missing values using GLOBAL statistics, not per-label statistics.
    This prevents data leakage where missing values are imputed differently
    for legitimate vs. fake companies.
    """

    # Domain age — use global median (not per-label)
    if df["domain_age_days"].notna().sum() > 0:
        global_median_age = df["domain_age_days"].median()
    else:
        global_median_age = 3650  # fallback ~10 years
    df["domain_age_days"] = df["domain_age_days"].fillna(global_median_age)

    # Content score — use global median (not per-label)
    if "content_score" in df.columns and df["content_score"].notna().sum() > 0:
        global_median_cs = df["content_score"].median()
        df["content_score"] = df["content_score"].fillna(global_median_cs)
    else:
        df["content_score"] = df["content_score"].fillna(0.0)

    # Review score — use global mean (not per-label)
    if "review_score" in df.columns and df["review_score"].notna().sum() > 0:
        global_mean_rs = df["review_score"].mean()
        df["review_score"] = df["review_score"].fillna(global_mean_rs)
    else:
        df["review_score"] = df["review_score"].fillna(0.0)

    # Review count — fill with 0 (no reviews → count is 0)
    df["review_count"] = df["review_count"].fillna(0)

    # All binary columns → fill with 0 (safe default for missing binary flags)
    binary_cols = [
        "has_https", "has_privacy_policy", "has_terms",
        "has_payment_risk", "has_urgency_language",
        "has_about", "has_contact", "website_alive", "valid_website",
        "is_registered", "has_glassdoor", "has_indeed", "has_trustpilot",
        "has_negative_reviews", "has_positive_reviews",
        "has_topjobs_lk", "has_ikman_lk", "has_ft_lk", "has_cse_boi_mention",
    ]
    for col in binary_cols:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(int)

    return df


# ── Encode categoricals ────────────────────────────────────────────────────

def encode_email_type(df: pd.DataFrame) -> pd.DataFrame:
    # company=2, unknown=1, free=0
    mapping = {"company": 2, "unknown": 1, "free": 0}
    if "email_type" in df.columns:
        df["email_type_encoded"] = (
            df["email_type"].map(mapping).fillna(1).astype(int)
        )
    return df


# ── Derived features ───────────────────────────────────────────────────────

def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    # Suspicious TLD
    suspicious_tlds = [".xyz", ".club", ".biz", ".online", ".site", ".info", ".io"]
    df["has_suspicious_tld"] = df["website_url"].apply(
        lambda u: 1 if any(t in str(u).lower() for t in suspicious_tlds) else 0
    )

    # HTTP only (no HTTPS)
    df["is_http_only"] = (df["has_https"] == 0).astype(int)

    # Trust score — sum of positive signals
    trust_cols = [
        "has_https", "has_about", "has_contact", "has_privacy_policy",
        "has_terms", "is_registered", "website_alive",
        "has_glassdoor", "has_indeed", "has_trustpilot",
        "has_topjobs_lk", "has_ikman_lk", "has_ft_lk",
        "has_cse_boi_mention", "has_positive_reviews",
    ]
    available_trust = [c for c in trust_cols if c in df.columns]
    df["trust_score"] = df[available_trust].sum(axis=1)

    # Suspicion score — sum of negative signals
    sus_cols = [
        "has_payment_risk", "has_urgency_language",
        "has_suspicious_tld", "is_http_only",
        "has_negative_reviews",
    ]
    available_sus = [c for c in sus_cols if c in df.columns]
    df["suspicion_score"] = df[available_sus].sum(axis=1)

    return df


# ── Final feature columns ──────────────────────────────────────────────────

FEATURE_COLS = [
    # Original features
    "website_alive",
    "valid_website",
    "has_about",
    "has_contact",
    "subdomain_count",
    "domain_length",
    "content_length",
    "scam_score",

    # New website features
    "has_https",
    "domain_age_days",
    "has_privacy_policy",
    "has_terms",
    "has_payment_risk",
    "has_urgency_language",
    "content_score",
    "is_registered",

    # Review features
    "review_score",
    "review_count",
    "has_glassdoor",
    "has_indeed",
    "has_trustpilot",
    "has_negative_reviews",
    "has_positive_reviews",

    # Encoded / derived
    "email_type_encoded",
    "has_suspicious_tld",
    "is_http_only",
    "trust_score",
    "suspicion_score",
]

META_COLS   = ["company_name", "website_url", "label"]
OUTPUT_COLS = META_COLS + FEATURE_COLS


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    os.makedirs("data/final", exist_ok=True)

    print(f"Loading : {INPUT}")
    df = pd.read_csv(INPUT)
    print(f"Rows    : {len(df)}")
    print(f"Columns : {df.columns.tolist()}\n")

    print("Step 1 : Filling missing values...")
    df = fill_missing(df)

    print("Step 2 : Encoding email_type...")
    df = encode_email_type(df)

    print("Step 3 : Adding derived features...")
    df = add_derived_features(df)

    # Keep only columns that exist
    available = [c for c in OUTPUT_COLS if c in df.columns]
    missing   = [c for c in OUTPUT_COLS if c not in df.columns]
    if missing:
        print(f"\n⚠️  Columns not found (skipped): {missing}")

    df_out = df[available].copy()

    # ── Report ─────────────────────────────────────────────────────────────
    print(f"\n{'='*55}")
    print(f"FINAL DATASET REPORT")
    print(f"{'='*55}")
    print(f"Total rows       : {len(df_out)}")
    print(f"Legit (1)        : {(df_out['label']==1).sum()}")
    print(f"Fake  (0)        : {(df_out['label']==0).sum()}")
    print(f"Feature columns  : {len(available) - len(META_COLS)}")
    print(f"Remaining NaNs   : {df_out.isna().sum().sum()}")

    feat_cols_available = [c for c in FEATURE_COLS if c in df_out.columns]
    print(f"\nFeature means by label (Fake=0 vs Legit=1):")
    summary = (
        df_out.groupby("label")[feat_cols_available]
        .mean()
        .round(2)
        .T
        .rename(columns={0: "Fake(0)", 1: "Legit(1)"})
    )
    print(summary.to_string())

    df_out.to_csv(OUTPUT, index=False)
    print(f"\n✅ Saved → {OUTPUT}")
    print("   Ready for model training!")
    print(f"\nNext step:")
    print(f"   python src/train_model.py")


if __name__ == "__main__":
    main()