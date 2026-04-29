"""
02b_filter_augmentations.py
============================
Filters the augmented dataset to remove low-quality samples that slipped past
the original quality check in 02_data_augmentation.py.

WHY THIS SCRIPT EXISTS:
After running 02_data_augmentation.py, manual inspection revealed:
  1. A small number of rows (e.g., 1 French row) where the back-translation
     left untranslated foreign-language fragments inside English text.
  2. ~86 rows where Google Translate produced a near-identical sentence
     (>85% word overlap with the original) — these add no learning value.

This script does a stricter pass on the augmented file and saves a clean version.
The original `augmented_real.csv` is NOT modified (kept as audit trail).

INPUT:
    data/augmented/augmented_real.csv    (105 originals + ~304 augmentations)

OUTPUT:
    data/augmented/augmented_real_filtered.csv   (filtered, training-ready)
    data/augmented/filter_report.txt
    data/augmented/dropped_samples.csv           (what we removed, for audit)

USAGE:
    cd services/scam-detection
    python notebooks/02b_filter_augmentations.py
"""

import re
import pandas as pd
from pathlib import Path

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = SCRIPT_DIR.parent
AUG_DIR = SERVICE_ROOT / "data" / "augmented"

INPUT_FILE = AUG_DIR / "augmented_real.csv"
OUTPUT_FILE = AUG_DIR / "augmented_real_filtered.csv"
DROPPED_FILE = AUG_DIR / "dropped_samples.csv"
REPORT_FILE = AUG_DIR / "filter_report.txt"

# Stricter overlap threshold: drop augmentations that share >85% words with original
MAX_WORD_OVERLAP = 0.85

# -----------------------------------------------------------------------------
# QUALITY DETECTION FUNCTIONS
# -----------------------------------------------------------------------------

# Common foreign-language tokens that shouldn't appear in English text
# If we see these, the back-translation didn't fully complete.
FOREIGN_FRAGMENTS = [
    # French
    r"\bnous sommes\b", r"\bnous avons\b", r"\bd'emploi\b", r"\bvotre\b",
    r"\bbonjour\b", r"\bje suis\b", r"\bvous êtes\b", r"\bmerci\b",
    # Spanish (in case it leaks through)
    r"\bhola\b", r"\bgracias\b", r"\bbuenos días\b",
    # German
    r"\bguten tag\b", r"\bdanke\b",
]
FOREIGN_PATTERN = re.compile("|".join(FOREIGN_FRAGMENTS), re.IGNORECASE)


def has_foreign_fragments(text):
    """True if text contains untranslated foreign-language phrases."""
    if not isinstance(text, str):
        return False
    return bool(FOREIGN_PATTERN.search(text))


def word_overlap(original, augmented):
    """Fraction of original's unique words that also appear in augmented."""
    if not isinstance(original, str) or not isinstance(augmented, str):
        return 1.0
    orig_words = set(original.lower().split())
    aug_words = set(augmented.lower().split())
    if len(orig_words) == 0:
        return 1.0
    return len(orig_words & aug_words) / len(orig_words)


# -----------------------------------------------------------------------------
# FILTERING
# -----------------------------------------------------------------------------

def filter_dataset(df):
    """
    Apply two filters to augmented rows (originals are always kept):
      1. Drop rows with foreign-language fragments
      2. Drop rows whose word overlap with original > MAX_WORD_OVERLAP
    """
    # Build lookup: msg_id (string) -> original text
    originals = df[df["aug_method"] == "original"].copy()
    orig_lookup = dict(zip(originals["msg_id"].astype(str), originals["text"]))

    keep_rows = []
    drop_rows = []

    for _, row in df.iterrows():
        method = row["aug_method"]
        text = row["text"]

        # Always keep originals — they ARE the gold
        if method == "original":
            keep_rows.append({**row.to_dict(), "drop_reason": None})
            continue

        # Reason 1: foreign-language fragments
        if has_foreign_fragments(text):
            drop_rows.append({**row.to_dict(), "drop_reason": "foreign_fragments"})
            continue

        # Reason 2: too similar to original (no learning value)
        # Extract the parent original ID by stripping the language suffix
        msg_id = str(row["msg_id"])
        if "_" in msg_id:
            orig_id = msg_id.rsplit("_", 1)[0]
        else:
            orig_id = msg_id
        orig_text = orig_lookup.get(orig_id)
        if orig_text is None:
            # Shouldn't happen, but if no parent original exists, drop it
            drop_rows.append({**row.to_dict(), "drop_reason": "no_parent_original"})
            continue

        overlap = word_overlap(orig_text, text)
        if overlap > MAX_WORD_OVERLAP:
            drop_rows.append({
                **row.to_dict(),
                "drop_reason": f"too_similar_overlap_{overlap:.2f}"
            })
            continue

        # Passed all filters — keep
        keep_rows.append({**row.to_dict(), "drop_reason": None})

    kept_df = pd.DataFrame(keep_rows).drop(columns=["drop_reason"])
    dropped_df = pd.DataFrame(drop_rows)
    return kept_df, dropped_df


# -----------------------------------------------------------------------------
# REPORTING
# -----------------------------------------------------------------------------

def make_report(input_df, kept_df, dropped_df):
    lines = []
    lines.append("=" * 70)
    lines.append("AUGMENTATION FILTER REPORT")
    lines.append("=" * 70)
    lines.append(f"\nInput rows: {len(input_df)}")
    lines.append(f"Kept rows:  {len(kept_df)}")
    lines.append(f"Dropped rows: {len(dropped_df)}")

    if len(dropped_df) > 0:
        lines.append(f"\nDrop reasons:")
        for reason, count in dropped_df["drop_reason"].value_counts().items():
            # Group all 'too_similar_*' into one row for readability
            display = "too_similar (>85% word overlap)" if reason.startswith("too_similar") else reason
            lines.append(f"  {display}: {count}") if not reason.startswith("too_similar") else None
        too_sim = dropped_df["drop_reason"].astype(str).str.startswith("too_similar").sum()
        if too_sim > 0:
            lines.append(f"  too_similar (>85% word overlap): {too_sim}")
        foreign = (dropped_df["drop_reason"] == "foreign_fragments").sum()
        if foreign > 0:
            lines.append(f"  foreign_fragments (untranslated text): {foreign}")
        no_parent = (dropped_df["drop_reason"] == "no_parent_original").sum()
        if no_parent > 0:
            lines.append(f"  no_parent_original: {no_parent}")

    lines.append(f"\nFinal kept dataset breakdown:")
    lines.append(f"  Originals: {(kept_df['aug_method'] == 'original').sum()}")
    lines.append(f"  Augmented: {(kept_df['aug_method'] != 'original').sum()}")
    lines.append(f"\n  Per-method breakdown:")
    for method, count in kept_df["aug_method"].value_counts().items():
        lines.append(f"    {method}: {count}")

    lines.append(f"\nLabel distribution (after filter):")
    for label, count in kept_df["label"].value_counts().sort_index().items():
        name = "legitimate" if label == 0 else "scam"
        lines.append(f"  {name} ({label}): {count}")

    lines.append(f"\nTactic counts (after filter):")
    for tac in ["urgency", "fomo", "sunk_cost", "social_proof"]:
        col = f"tactic_{tac}"
        if col in kept_df.columns:
            count = int(kept_df[col].sum())
            lines.append(f"  tactic_{tac:<14}: {count}")
    no_tactic = int((kept_df["has_tactic"] == 0).sum())
    lines.append(f"  no_tactic       : {no_tactic}")

    lines.append("\n" + "=" * 70)
    lines.append("Use augmented_real_filtered.csv for training.")
    lines.append("Combined with cleaned_synthetic.csv = your full training pool.")
    lines.append("=" * 70)
    return "\n".join(lines)


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------

def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Missing: {INPUT_FILE}\n"
            f"Run notebooks/02_data_augmentation.py first."
        )

    df = pd.read_csv(INPUT_FILE)
    print(f"Loaded {len(df)} rows from {INPUT_FILE.name}")
    print(f"Filtering with MAX_WORD_OVERLAP = {MAX_WORD_OVERLAP}...")

    kept_df, dropped_df = filter_dataset(df)

    # Save outputs
    kept_df.to_csv(OUTPUT_FILE, index=False, encoding="utf-8")
    dropped_df.to_csv(DROPPED_FILE, index=False, encoding="utf-8")
    report = make_report(df, kept_df, dropped_df)
    REPORT_FILE.write_text(report, encoding="utf-8")

    print("\n" + report)
    print(f"\nSaved: {OUTPUT_FILE}")
    print(f"Saved: {DROPPED_FILE}  (audit trail of removed rows)")
    print(f"Saved: {REPORT_FILE}")


if __name__ == "__main__":
    main()
