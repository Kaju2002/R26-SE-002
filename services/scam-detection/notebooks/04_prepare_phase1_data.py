"""
04_prepare_phase1_data.py
==========================
Merges binary-labeled scam data into a Phase 1 corpus.

Handles:
  - EMSCAD with various label formats (1/0, t/f, True/False, "yes"/"no")
  - UCI SMS Spam in Kaggle format (v1, v2) or original tab-separated
  - Stratified sampling that preserves all columns
  - Verbose output so you can see what's loaded

USAGE:
  cd services/scam-detection
  python notebooks/04_prepare_phase1_data.py
"""

from pathlib import Path
import numpy as np
import pandas as pd

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
SERVICE_ROOT = SCRIPT_DIR.parent

RAW_DIR = SERVICE_ROOT / "data" / "raw"
CLEAN_DIR = SERVICE_ROOT / "data" / "cleaned"
AUG_DIR = SERVICE_ROOT / "data" / "augmented"
PHASE1_DIR = SERVICE_ROOT / "data" / "phase1"
PHASE1_DIR.mkdir(parents=True, exist_ok=True)

EMSCAD_PATH = RAW_DIR / "emscad.csv"
SMS_PATH = RAW_DIR / "sms_spam.csv"
SYN_PATH = CLEAN_DIR / "cleaned_synthetic.csv"
REAL_PATH = AUG_DIR / "augmented_real_filtered.csv"

EMSCAD_CAP = 5000
SMS_CAP = 4000


def normalize_binary_label(value):
    """
    Convert various binary label representations to int 0 or 1.
    Handles: 1, 0, "1", "0", "t", "f", "true", "false",
             "yes", "no", "spam", "ham", "scam", "legit", True, False
    Returns None if unrecognized.
    """
    if pd.isna(value):
        return None
    # Already numeric?
    if isinstance(value, (int, float, np.integer, np.floating)):
        if int(value) in (0, 1):
            return int(value)
        return None
    # String?
    s = str(value).strip().lower()
    positives = {"1", "t", "true", "yes", "y", "spam", "scam", "fraud", "fraudulent"}
    negatives = {"0", "f", "false", "no", "n", "ham", "legit", "legitimate", "not_fraud"}
    if s in positives:
        return 1
    if s in negatives:
        return 0
    return None


def stratified_cap(df, label_col, cap, seed=42):
    """
    Stratified down-sampling that PRESERVES all columns.
    Splits dataframe by class, samples each class separately, concatenates.
    Avoids pandas groupby-apply column-drop bug.
    """
    if len(df) <= cap:
        return df.reset_index(drop=True)

    samples_per_class = cap // 2
    sampled_parts = []
    for class_value in sorted(df[label_col].unique()):
        class_df = df[df[label_col] == class_value]
        n_take = min(len(class_df), samples_per_class)
        sampled_parts.append(class_df.sample(n=n_take, random_state=seed))
    return pd.concat(sampled_parts, ignore_index=True)


# -----------------------------------------------------------------------------
# EMSCAD LOADER
# -----------------------------------------------------------------------------
def load_emscad(path):
    if not path.exists():
        print(f"  [SKIP] EMSCAD not found at {path}")
        return None

    df = pd.read_csv(path)
    print(f"  [INFO] EMSCAD columns: {list(df.columns)[:8]}...")

    text_col = None
    for c in ["description", "Description", "job_description", "text"]:
        if c in df.columns:
            text_col = c
            break

    label_col = None
    for c in ["fraudulent", "Fraudulent", "is_fraud", "label", "class", "target"]:
        if c in df.columns:
            label_col = c
            break

    if text_col is None or label_col is None:
        print(f"  [SKIP] EMSCAD: missing text or label column")
        return None

    print(f"  [INFO] Using '{text_col}' for text, '{label_col}' for label")

    # Show label distribution BEFORE conversion (for debugging)
    raw_label_counts = df[label_col].value_counts(dropna=False).to_dict()
    print(f"  [INFO] Raw label values in '{label_col}': {raw_label_counts}")

    df = df[[text_col, label_col]].rename(columns={text_col: "text", label_col: "label_raw"})
    df = df.dropna(subset=["text", "label_raw"])

    # Convert label using robust normalizer
    df["label"] = df["label_raw"].apply(normalize_binary_label)
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)

    # Show converted distribution
    print(f"  [INFO] After conversion: scam={int((df['label']==1).sum())}, "
          f"legit={int((df['label']==0).sum())}")

    df["text"] = df["text"].astype(str).str.strip()
    df = df[df["text"].str.len() > 20].reset_index(drop=True)

    df = df[["text", "label"]]
    df = stratified_cap(df, "label", EMSCAD_CAP)

    df["source"] = "emscad"
    return df[["text", "label", "source"]]


# -----------------------------------------------------------------------------
# UCI SMS LOADER
# -----------------------------------------------------------------------------
def load_sms_spam(path):
    if not path.exists():
        print(f"  [SKIP] UCI SMS Spam not found at {path}")
        return None

    df = None

    # Try CSV format (Kaggle version)
    try:
        attempt = pd.read_csv(path, encoding='latin-1')
        cols = list(attempt.columns)
        print(f"  [INFO] UCI SMS columns: {cols[:5]}")

        if "v1" in attempt.columns and "v2" in attempt.columns:
            df = attempt[["v1", "v2"]].rename(columns={"v1": "label_raw", "v2": "text"})
            print(f"  [INFO] Kaggle format detected (v1/v2)")
        elif "Category" in attempt.columns and "Message" in attempt.columns:
            df = attempt[["Category", "Message"]].rename(columns={"Category": "label_raw", "Message": "text"})
        elif "label" in attempt.columns and "text" in attempt.columns:
            df = attempt[["label", "text"]].rename(columns={"label": "label_raw"})
        elif "label" in attempt.columns and "message" in attempt.columns:
            df = attempt[["label", "message"]].rename(columns={"label": "label_raw", "message": "text"})
    except Exception as e:
        print(f"  [INFO] CSV parse attempt failed: {e}")

    # Fallback to tab-separated UCI format
    if df is None:
        for encoding in ["utf-8", "latin-1"]:
            try:
                df = pd.read_csv(path, sep="\t", header=None,
                                 names=["label_raw", "text"], encoding=encoding)
                print(f"  [INFO] Tab-separated format detected ({encoding})")
                break
            except Exception:
                continue

    if df is None:
        print(f"  [SKIP] UCI SMS: could not parse")
        return None

    df = df.dropna(subset=["text", "label_raw"])
    print(f"  [INFO] Raw label values: {df['label_raw'].value_counts().head(5).to_dict()}")

    df["label"] = df["label_raw"].apply(normalize_binary_label)
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)
    df["text"] = df["text"].astype(str).str.strip()
    df = df[df["text"].str.len() > 5].reset_index(drop=True)

    print(f"  [INFO] After conversion: scam={int((df['label']==1).sum())}, "
          f"legit={int((df['label']==0).sum())}")

    if len(df) == 0:
        print(f"  [SKIP] UCI SMS: 0 samples after parsing")
        return None

    df = df[["text", "label"]]
    df = stratified_cap(df, "label", SMS_CAP)

    df["source"] = "uci_sms"
    return df[["text", "label", "source"]]


# -----------------------------------------------------------------------------
# YOUR DATA LOADERS
# -----------------------------------------------------------------------------
def load_synthetic(path):
    if not path.exists():
        return None
    df = pd.read_csv(path)
    if "text" not in df.columns or "label" not in df.columns:
        print(f"  [SKIP] Synthetic missing text/label.")
        return None
    df = df[["text", "label"]].copy().dropna(subset=["text", "label"])
    df["label"] = df["label"].astype(int)
    df["source"] = "your_synthetic"
    return df[["text", "label", "source"]]


def load_real_augmented(path):
    if not path.exists():
        return None
    df = pd.read_csv(path)
    if "text" not in df.columns or "label" not in df.columns:
        print(f"  [SKIP] Real missing text/label.")
        return None
    df = df[["text", "label"]].copy().dropna(subset=["text", "label"])
    df["label"] = df["label"].astype(int)
    df["source"] = "your_real"
    return df[["text", "label", "source"]]


# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
def main():
    print("=" * 70)
    print("PREPARING PHASE 1 BINARY CORPUS")
    print("=" * 70)
    print()

    parts = []
    for name, loader, path in [
        ("EMSCAD",     load_emscad,         EMSCAD_PATH),
        ("UCI SMS",    load_sms_spam,       SMS_PATH),
        ("Synthetic",  load_synthetic,      SYN_PATH),
        ("Your Real",  load_real_augmented, REAL_PATH),
    ]:
        print(f"--- Loading {name} ---")
        df = loader(path)
        if df is not None and len(df) > 0:
            scam_count = int((df["label"] == 1).sum())
            legit_count = int((df["label"] == 0).sum())
            print(f"  [OK] {name}: {len(df)} samples ({scam_count} scam, {legit_count} legit)")
            parts.append(df)
        print()

    if not parts:
        raise RuntimeError("No datasets loaded.")

    combined = pd.concat(parts, ignore_index=True)
    combined = combined.dropna(subset=["text", "label"])
    combined["label"] = combined["label"].astype(int)
    combined = combined[combined["text"].astype(str).str.strip() != ""].reset_index(drop=True)

    out_path = PHASE1_DIR / "phase1_binary_corpus.csv"
    combined.to_csv(out_path, index=False, encoding="utf-8")

    lines = []
    lines.append("=" * 70)
    lines.append("PHASE 1 BINARY CORPUS REPORT")
    lines.append("=" * 70)
    lines.append(f"\nTotal samples: {len(combined)}")
    lines.append(f"\nBy source:")
    for src in combined["source"].unique():
        sub = combined[combined["source"] == src]
        scam = int((sub["label"] == 1).sum())
        legit = int((sub["label"] == 0).sum())
        lines.append(f"  {src:<20} {len(sub):>6}  (scam={scam}, legit={legit})")
    lines.append(f"\nOverall:")
    lines.append(f"  scam : {int((combined['label']==1).sum())}")
    lines.append(f"  legit: {int((combined['label']==0).sum())}")
    lines.append("\n" + "=" * 70)
    lines.append("USE: data/phase1/phase1_binary_corpus.csv as input to Phase 1 training.")
    lines.append("=" * 70)

    report_path = PHASE1_DIR / "phase1_report.txt"
    report_path.write_text("\n".join(lines), encoding="utf-8")

    print("\n".join(lines))
    print(f"\nSaved: {out_path}")
    print(f"Saved: {report_path}")


if __name__ == "__main__":
    main()