"""
01_data_cleaning.py
====================
Cleans raw scam communication datasets for the BSTD scam detection model.

WHAT THIS SCRIPT DOES:
1. Fixes broken encoding (e.g., "We�ve" -> "We've")
2. Strips whitespace and normalizes platform/speaker columns
3. Collapses 56 messy tactic labels into 5 canonical ones
4. Converts comma-separated tactics into 4 binary columns (multi-label format)
5. Drops invalid/empty rows
6. Saves cleaned CSVs + a before/after report

INPUT:
    data/raw/communication_dataset.csv   (1000 synthetic samples)
    data/raw/realdata_1.csv              (105 real samples)

OUTPUT:
    data/cleaned/cleaned_synthetic.csv
    data/cleaned/cleaned_real.csv
    data/cleaned/cleaning_report.txt

USAGE:
    cd services/scam-detection
    python notebooks/01_data_cleaning.py
"""

import os
import re
import pandas as pd
from pathlib import Path

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
# Resolve paths relative to this script's location so it works from anywhere.
SCRIPT_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = SCRIPT_DIR.parent  # services/scam-detection/
RAW_DIR = SERVICE_ROOT / "data" / "raw"
CLEAN_DIR = SERVICE_ROOT / "data" / "cleaned"
CLEAN_DIR.mkdir(parents=True, exist_ok=True)

# The ONLY 4 tactics our model classifies (plus implicit "none")
CANONICAL_TACTICS = ["urgency", "fomo", "sunk_cost", "social_proof"]

# -----------------------------------------------------------------------------
# CLEANING FUNCTIONS
# -----------------------------------------------------------------------------

def fix_encoding(text):
    """Fix common mojibake (broken Unicode) issues."""
    if not isinstance(text, str):
        return ""
    # Common mojibake replacements seen in the dataset
    replacements = {
        "\ufffd": "'",   # � replacement character (most likely a curly apostrophe)
        "\u2019": "'",   # right single quote
        "\u2018": "'",   # left single quote
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
        "\u2013": "-",   # en dash
        "\u2014": "-",   # em dash
        "\u00a0": " ",   # non-breaking space
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    # Collapse multiple whitespace into one
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_platform(value):
    """Strip whitespace and merge duplicate platform names."""
    if not isinstance(value, str):
        return "unknown"
    v = value.strip().lower()
    # Map variations to canonical names
    mapping = {
        "whatsapp": "WhatsApp",
        "email": "Email",
        "linkedin": "LinkedIn",
        "telegram": "Telegram",
        "sms": "SMS",
        "topjobs.lk": "topjobs",
        "topjobs": "topjobs",
        "indeed": "Indeed",
        "ikman": "ikman",
        "ikman.lk": "ikman",
        "other": "other",
    }
    return mapping.get(v, "other")


def normalize_speaker(value):
    """Collapse 45+ random speaker titles into 3 categories."""
    if not isinstance(value, str):
        return "other"
    v = value.strip().lower()
    if "recruit" in v or "agent" in v or "agency" in v or "talent" in v or "placement" in v:
        return "recruiter"
    if "hr" in v or "human resource" in v or "onboarding" in v or "hiring manager" in v:
        return "hr"
    if "attacker" in v:
        return "attacker"
    return "other"


def parse_tactics(raw_value):
    """
    Parse the messy tactic field into a clean list of canonical tactics.

    Examples:
      "sunk_cost, urgency"          -> ["sunk_cost", "urgency"]
      "sunk_cost,urgency"           -> ["sunk_cost", "urgency"]
      "sunk_cost,  urgency, fomo"   -> ["sunk_cost", "urgency", "fomo"]
      "professional_outreach"       -> []   (not a real tactic, becomes "none")
      "none"                        -> []
      NaN / empty                   -> []
    """
    if not isinstance(raw_value, str) or not raw_value.strip():
        return []
    # Split on comma, strip each piece, lowercase, remove empties
    parts = [p.strip().lower().replace(" ", "_") for p in raw_value.split(",")]
    parts = [p for p in parts if p]
    # Keep only canonical tactics — everything else (onboarding, confirmation,
    # job_advertisement, etc.) is treated as "none"
    cleaned = [p for p in parts if p in CANONICAL_TACTICS]
    # Deduplicate while preserving order
    seen = set()
    result = []
    for p in cleaned:
        if p not in seen:
            seen.add(p)
            result.append(p)
    return result


def clean_dataframe(df, source_name):
    """Apply all cleaning steps to a dataframe."""
    print(f"\n[{source_name}] Starting clean. Initial shape: {df.shape}")

    # --- 1. Drop rows with missing text or label ---
    before = len(df)
    df = df.dropna(subset=["text", "label"]).copy()
    df = df[df["text"].astype(str).str.strip() != ""]
    print(f"[{source_name}] Dropped {before - len(df)} rows with empty text/label")

    # --- 2. Fix encoding in text column ---
    df["text"] = df["text"].apply(fix_encoding)

    # --- 3. Coerce label to int (0 or 1) ---
    df["label"] = pd.to_numeric(df["label"], errors="coerce")
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)
    df = df[df["label"].isin([0, 1])]

    # --- 4. Normalize platform & speaker ---
    df["platform"] = df["platform"].apply(normalize_platform)
    df["speaker"] = df["speaker"].apply(normalize_speaker)

    # --- 5. Normalize stage (lowercase, strip) ---
    df["stage"] = df["stage"].astype(str).str.strip().str.lower()

    # --- 6. Parse tactics into binary columns (multi-label format) ---
    parsed_tactics = df["tactic"].apply(parse_tactics)
    for tac in CANONICAL_TACTICS:
        df[f"tactic_{tac}"] = parsed_tactics.apply(lambda lst: int(tac in lst))

    # has_tactic = 1 if ANY tactic is present, else 0 (= "none")
    df["has_tactic"] = parsed_tactics.apply(lambda lst: int(len(lst) > 0))

    # Keep a clean human-readable tactic string too (for inspection only)
    df["tactic_clean"] = parsed_tactics.apply(
        lambda lst: ",".join(lst) if lst else "none"
    )

    # --- 7. Coerce urgency score to int (1-5), default 3 ---
    df["urgency"] = pd.to_numeric(df["urgency"], errors="coerce").fillna(3).astype(int)
    df["urgency"] = df["urgency"].clip(1, 5)

    # --- 8. Final column order ---
    final_cols = [
        "msg_id", "speaker", "text", "label",
        "tactic_urgency", "tactic_fomo", "tactic_sunk_cost", "tactic_social_proof",
        "has_tactic", "tactic_clean",
        "stage", "platform", "urgency"
    ]
    df = df[final_cols]

    print(f"[{source_name}] Final shape: {df.shape}")
    return df


# -----------------------------------------------------------------------------
# REPORTING
# -----------------------------------------------------------------------------

def make_report(syn_before, syn_after, real_before, real_after):
    """Build a before/after report for the cleaning."""
    lines = []
    lines.append("=" * 70)
    lines.append("DATA CLEANING REPORT")
    lines.append("=" * 70)

    for name, before_df, after_df in [
        ("SYNTHETIC", syn_before, syn_after),
        ("REAL",      real_before, real_after),
    ]:
        lines.append(f"\n--- {name} DATASET ---")
        lines.append(f"Rows before: {len(before_df)}    Rows after: {len(after_df)}")
        lines.append(f"\nLabel distribution (after):")
        lines.append(after_df["label"].value_counts().to_string())

        lines.append(f"\nUnique tactic labels BEFORE cleaning: "
                     f"{before_df['tactic'].nunique()}")
        lines.append(f"Tactic binary columns AFTER (per-tactic positive count):")
        for tac in CANONICAL_TACTICS:
            count = int(after_df[f"tactic_{tac}"].sum())
            lines.append(f"  tactic_{tac:<14}: {count}")
        none_count = int((after_df["has_tactic"] == 0).sum())
        lines.append(f"  no_tactic (none): {none_count}")

        lines.append(f"\nPlatform distribution (after):")
        lines.append(after_df["platform"].value_counts().to_string())

        lines.append(f"\nSpeaker distribution (after):")
        lines.append(after_df["speaker"].value_counts().to_string())

    lines.append("\n" + "=" * 70)
    lines.append("DONE. Use cleaned_synthetic.csv + cleaned_real.csv for training.")
    lines.append("=" * 70)
    return "\n".join(lines)


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------

def main():
    syn_path = RAW_DIR / "communication_dataset.csv"
    real_path = RAW_DIR / "realdata_1.csv"

    if not syn_path.exists():
        raise FileNotFoundError(f"Missing: {syn_path}")
    if not real_path.exists():
        raise FileNotFoundError(f"Missing: {real_path}")

    # Load (try utf-8 first, fall back to latin-1 if encoding is broken)
    try:
        syn_raw = pd.read_csv(syn_path, encoding="utf-8")
    except UnicodeDecodeError:
        syn_raw = pd.read_csv(syn_path, encoding="latin-1")
    try:
        real_raw = pd.read_csv(real_path, encoding="utf-8")
    except UnicodeDecodeError:
        real_raw = pd.read_csv(real_path, encoding="latin-1")

    # Clean
    syn_clean = clean_dataframe(syn_raw.copy(), "SYNTHETIC")
    real_clean = clean_dataframe(real_raw.copy(), "REAL")

    # Save
    syn_out = CLEAN_DIR / "cleaned_synthetic.csv"
    real_out = CLEAN_DIR / "cleaned_real.csv"
    syn_clean.to_csv(syn_out, index=False, encoding="utf-8")
    real_clean.to_csv(real_out, index=False, encoding="utf-8")

    # Report
    report = make_report(syn_raw, syn_clean, real_raw, real_clean)
    report_path = CLEAN_DIR / "cleaning_report.txt"
    report_path.write_text(report, encoding="utf-8")

    print("\n" + report)
    print(f"\nSaved: {syn_out}")
    print(f"Saved: {real_out}")
    print(f"Saved: {report_path}")


if __name__ == "__main__":
    main()
