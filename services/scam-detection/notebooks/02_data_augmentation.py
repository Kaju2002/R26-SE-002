"""
02_data_augmentation.py
========================
Multiplies the cleaned REAL scam dataset 4× using back-translation through
3 different intermediate languages. All metadata (label, tactics, platform)
is preserved on every augmented row.

WHY BACK-TRANSLATION?
We translate each English message into another language, then translate it
back to English. The result keeps the same MEANING (so the manipulation
tactic survives) but uses different WORDS and SENTENCE STRUCTURE — so the
DistilBERT model learns the underlying pattern, not memorized phrases.

WHY 3 LANGUAGES?
- Sinhala: linguistically very different from English -> bigger paraphrase
- Tamil:   linguistically different + relevant to Sri Lankan context
- French:  high-quality translation, adds stylistic variation

INPUT:
    data/cleaned/cleaned_real.csv   (105 real samples after cleaning)

OUTPUT:
    data/augmented/augmented_real.csv      (105 originals + ~315 augmented)
    data/augmented/augmentation_report.txt
    data/augmented/samples_for_review.txt  (so you can spot-check quality)

USAGE:
    pip install deep-translator pandas tqdm
    cd services/scam-detection
    python notebooks/02_data_augmentation.py

NOTE ON RUNTIME:
    Each translation takes ~1-2 seconds (free Google Translate web).
    105 samples × 3 languages = 315 round-trips × 2 calls each = 630 calls.
    Expected runtime: 15-25 minutes. Run once, save the output, never re-run.
"""

import time
import pandas as pd
from pathlib import Path
from deep_translator import GoogleTranslator
from tqdm import tqdm

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = SCRIPT_DIR.parent  # services/scam-detection/
CLEAN_DIR = SERVICE_ROOT / "data" / "cleaned"
AUG_DIR = SERVICE_ROOT / "data" / "augmented"
AUG_DIR.mkdir(parents=True, exist_ok=True)

# Languages to round-trip through. Each one produces 1 augmentation per row.
INTERMEDIATE_LANGUAGES = [
    ("si", "Sinhala"),
    ("ta", "Tamil"),
    ("fr", "French"),
]

# How many retries on translation failure before giving up on that sample
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# Quality filter: skip augmentations that are too similar to the original
# (they add no learning value) or too short (translation likely failed)
MIN_LENGTH_RATIO = 0.5      # augmented must be >=50% length of original
MAX_LENGTH_RATIO = 2.0      # augmented must be <=200% length of original
MAX_IDENTITY_RATIO = 0.95   # if 95%+ of words match original, it's not really paraphrased

# -----------------------------------------------------------------------------
# AUGMENTATION FUNCTIONS
# -----------------------------------------------------------------------------

def back_translate(text, intermediate_lang_code):
    """
    Translate text English -> intermediate language -> English.
    Returns the back-translated text, or None if translation fails.
    """
    if not isinstance(text, str) or len(text.strip()) == 0:
        return None

    for attempt in range(MAX_RETRIES):
        try:
            # Step 1: English -> intermediate
            translator_to = GoogleTranslator(source='en', target=intermediate_lang_code)
            intermediate = translator_to.translate(text)
            if not intermediate or len(intermediate.strip()) == 0:
                return None

            # Step 2: intermediate -> English
            translator_back = GoogleTranslator(source=intermediate_lang_code, target='en')
            back = translator_back.translate(intermediate)
            if not back or len(back.strip()) == 0:
                return None

            return back.strip()

        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
                continue
            else:
                # Final failure — skip this augmentation
                print(f"  [WARN] Translation failed after {MAX_RETRIES} retries: {str(e)[:60]}")
                return None
    return None


def quality_check(original, augmented):
    """
    Return (is_acceptable, reason).
    Filters out augmentations that are too similar to original or malformed.
    """
    if not augmented or not isinstance(augmented, str):
        return False, "empty"

    orig_len = len(original)
    aug_len = len(augmented)

    if orig_len == 0:
        return False, "original_empty"

    # Length check
    ratio = aug_len / orig_len
    if ratio < MIN_LENGTH_RATIO:
        return False, f"too_short ({ratio:.2f})"
    if ratio > MAX_LENGTH_RATIO:
        return False, f"too_long ({ratio:.2f})"

    # Identity check — too similar to original = no learning value
    orig_words = set(original.lower().split())
    aug_words = set(augmented.lower().split())
    if len(orig_words) == 0:
        return False, "no_words"
    overlap = len(orig_words & aug_words) / len(orig_words)
    if overlap > MAX_IDENTITY_RATIO:
        return False, f"too_identical ({overlap:.2f})"

    return True, "ok"


# -----------------------------------------------------------------------------
# MAIN AUGMENTATION LOOP
# -----------------------------------------------------------------------------

def augment_dataset(real_df):
    """
    For each row in real_df, generate 3 augmented copies via back-translation.
    Returns a new dataframe containing originals + augmented rows.
    """
    augmented_rows = []
    stats = {"success": 0, "failed": 0, "filtered": 0}
    failure_reasons = {}

    print(f"\nAugmenting {len(real_df)} real samples through "
          f"{len(INTERMEDIATE_LANGUAGES)} languages...")
    print("Expected new samples: up to "
          f"{len(real_df) * len(INTERMEDIATE_LANGUAGES)}")
    print("This will take 15-25 minutes. Be patient.\n")

    # First, keep all originals (mark them as 'original')
    for _, row in real_df.iterrows():
        new_row = row.to_dict()
        new_row["aug_method"] = "original"
        augmented_rows.append(new_row)

    # Then generate augmentations
    total_jobs = len(real_df) * len(INTERMEDIATE_LANGUAGES)
    pbar = tqdm(total=total_jobs, desc="Augmenting", unit="aug")

    for _, row in real_df.iterrows():
        original_text = row["text"]
        for lang_code, lang_name in INTERMEDIATE_LANGUAGES:
            augmented_text = back_translate(original_text, lang_code)
            pbar.update(1)

            if augmented_text is None:
                stats["failed"] += 1
                continue

            ok, reason = quality_check(original_text, augmented_text)
            if not ok:
                stats["filtered"] += 1
                failure_reasons[reason] = failure_reasons.get(reason, 0) + 1
                continue

            # Build augmented row — copy all metadata, replace text only
            new_row = row.to_dict()
            new_row["text"] = augmented_text
            new_row["aug_method"] = f"backtrans_{lang_code}"
            # Reassign msg_id so it stays unique
            new_row["msg_id"] = f"{row['msg_id']}_{lang_code}"
            augmented_rows.append(new_row)
            stats["success"] += 1

            # Be polite to free Google Translate — small pause
            time.sleep(0.3)

    pbar.close()
    augmented_df = pd.DataFrame(augmented_rows)
    return augmented_df, stats, failure_reasons


# -----------------------------------------------------------------------------
# REPORTING
# -----------------------------------------------------------------------------

def make_report(orig_df, aug_df, stats, failure_reasons):
    lines = []
    lines.append("=" * 70)
    lines.append("DATA AUGMENTATION REPORT")
    lines.append("=" * 70)
    lines.append(f"\nOriginal real samples: {len(orig_df)}")
    lines.append(f"Total after augmentation: {len(aug_df)}")
    lines.append(f"  - Originals kept: {(aug_df['aug_method'] == 'original').sum()}")
    lines.append(f"  - Augmented added: {(aug_df['aug_method'] != 'original').sum()}")

    lines.append(f"\nAugmentation success rate:")
    lines.append(f"  Successful: {stats['success']}")
    lines.append(f"  Translation failed: {stats['failed']}")
    lines.append(f"  Filtered (low quality): {stats['filtered']}")
    if failure_reasons:
        lines.append(f"\n  Filter reasons breakdown:")
        for reason, count in sorted(failure_reasons.items(), key=lambda x: -x[1]):
            lines.append(f"    {reason}: {count}")

    lines.append(f"\nMethod breakdown:")
    for method, count in aug_df["aug_method"].value_counts().items():
        lines.append(f"  {method}: {count}")

    lines.append(f"\nLabel distribution (after augmentation):")
    lines.append(aug_df["label"].value_counts().to_string())

    lines.append(f"\nTactic counts (after augmentation):")
    for tac in ["urgency", "fomo", "sunk_cost", "social_proof"]:
        col = f"tactic_{tac}"
        if col in aug_df.columns:
            count = int(aug_df[col].sum())
            lines.append(f"  tactic_{tac:<14}: {count}")
    no_tactic = int((aug_df["has_tactic"] == 0).sum())
    lines.append(f"  no_tactic       : {no_tactic}")

    lines.append("\n" + "=" * 70)
    lines.append("Use augmented_real.csv for training (combined with cleaned_synthetic.csv).")
    lines.append("=" * 70)
    return "\n".join(lines)


def make_review_sample(aug_df, n=15):
    """Save N before/after pairs so the user can manually inspect quality."""
    augmented_only = aug_df[aug_df["aug_method"] != "original"].sample(
        n=min(n, len(aug_df)), random_state=42
    )
    lines = ["Spot-check 15 augmented samples vs originals.\n"
             "If most look natural and preserve meaning, augmentation is good.\n"]
    lines.append("=" * 70)

    for _, aug_row in augmented_only.iterrows():
        # Find original (msg_id without language suffix)
        orig_id = str(aug_row["msg_id"]).split("_")[0]
        try:
            orig_id_num = int(orig_id)
        except ValueError:
            continue
        orig = aug_df[
            (aug_df["msg_id"].astype(str) == str(orig_id_num)) &
            (aug_df["aug_method"] == "original")
        ]
        if len(orig) == 0:
            continue
        orig_row = orig.iloc[0]
        lines.append(f"\n[ID {orig_id_num}] tactic={aug_row['tactic_clean']}, "
                     f"label={aug_row['label']}, method={aug_row['aug_method']}")
        lines.append(f"ORIGINAL  : {orig_row['text']}")
        lines.append(f"AUGMENTED : {aug_row['text']}")
        lines.append("-" * 70)

    return "\n".join(lines)


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------

def main():
    real_path = CLEAN_DIR / "cleaned_real.csv"
    if not real_path.exists():
        raise FileNotFoundError(
            f"Missing: {real_path}\n"
            f"Run notebooks/01_data_cleaning.py first."
        )

    real_df = pd.read_csv(real_path)
    print(f"Loaded {len(real_df)} cleaned real samples.")

    aug_df, stats, failure_reasons = augment_dataset(real_df)

    # Save outputs
    aug_path = AUG_DIR / "augmented_real.csv"
    report_path = AUG_DIR / "augmentation_report.txt"
    review_path = AUG_DIR / "samples_for_review.txt"

    aug_df.to_csv(aug_path, index=False, encoding="utf-8")
    report = make_report(real_df, aug_df, stats, failure_reasons)
    report_path.write_text(report, encoding="utf-8")
    review = make_review_sample(aug_df, n=15)
    review_path.write_text(review, encoding="utf-8")

    print("\n" + report)
    print(f"\nSaved: {aug_path}")
    print(f"Saved: {report_path}")
    print(f"Saved: {review_path}")
    print("\nNEXT STEP: Open samples_for_review.txt and read 15 before/after")
    print("pairs. If they look natural and preserve meaning -> augmentation is good.")


if __name__ == "__main__":
    main()
