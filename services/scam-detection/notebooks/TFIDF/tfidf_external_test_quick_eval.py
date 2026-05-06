"""
Train on cleaned_synthetic.csv
Test on augmented_real_filtered.csv

Text-only binary classification (SCAM vs LEGIT) using TF-IDF + Logistic Regression.
"""

from pathlib import Path
import re
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.metrics.pairwise import linear_kernel


def normalize_label(label_value):
    """Normalize label formats into SCAM / LEGIT."""
    if pd.isna(label_value):
        return None

    try:
        numeric = float(label_value)
        if numeric == 1.0:
            return "SCAM"
        if numeric == 0.0:
            return "LEGIT"
    except (TypeError, ValueError):
        pass

    value = str(label_value).strip().lower()
    if value in {"scam", "fraud", "spam", "phishing"}:
        return "SCAM"
    if value in {"legit", "legitimate", "ham", "safe", "not scam"}:
        return "LEGIT"
    return str(label_value).strip().upper()


def load_text_label(csv_path: Path) -> pd.DataFrame:
    """Load CSV and keep clean text+label rows only."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Missing dataset: {csv_path}")

    df = pd.read_csv(csv_path)
    required = {"text", "label"}
    if not required.issubset(df.columns):
        raise ValueError(f"{csv_path} must contain {required}. Found: {list(df.columns)}")

    df = df[["text", "label"]].copy()
    df = df.dropna(subset=["text", "label"])
    df["text"] = df["text"].astype(str).str.strip()
    df = df[df["text"] != ""]
    df["label"] = df["label"].apply(normalize_label)
    df = df[df["label"].isin(["SCAM", "LEGIT"])].reset_index(drop=True)
    return df


def canonicalize_text(text: str) -> str:
    """Create a normalized text key to detect overlap leaks."""
    text = str(text).lower().strip()
    text = re.sub(r"\s+", " ", text)
    # Keep letters and digits only for robust matching across punctuation changes.
    text = re.sub(r"[^a-z0-9 ]", "", text)
    return text


def remove_near_duplicate_train_rows(
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    similarity_threshold: float = 0.92,
):
    """
    Remove train rows that are too similar to any test row.
    Similarity is cosine on character n-gram TF-IDF.
    """
    sim_vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1)
    train_mat = sim_vectorizer.fit_transform(train_df["text"])
    test_mat = sim_vectorizer.transform(test_df["text"])
    sim = linear_kernel(test_mat, train_mat)  # (n_test, n_train)
    max_sim_per_train = sim.max(axis=0)
    keep_mask = max_sim_per_train < similarity_threshold
    filtered_train = train_df[keep_mask].reset_index(drop=True)
    removed = int((~keep_mask).sum())
    return filtered_train, removed


def evaluate(name, model, X_train, y_train, X_test, y_test):
    """Print evaluation metrics for test dataset."""
    train_pred = model.predict(X_train)
    y_pred = model.predict(X_test)
    train_acc = accuracy_score(y_train, train_pred)
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred, labels=["LEGIT", "SCAM"])

    print(f"\n===== {name} =====")
    print(f"Train accuracy: {train_acc:.4f}")
    print(f"Test accuracy: {acc:.4f}")
    print(f"Gap (train-test): {train_acc - acc:.4f}")
    print("Confusion Matrix (rows=true, cols=pred):")
    print(cm)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, digits=4))


def main():
    project_root = Path(__file__).resolve().parents[2]
    train_path = project_root / "data" / "cleaned" / "cleaned_synthetic.csv"
    test_aug_path = project_root / "data" / "augmented" / "augmented_real_filtered.csv"
    test_real54_path = project_root / "data" / "augmented" / "real_messages_54.csv"

    train_df = load_text_label(train_path)
    test_aug_df = load_text_label(test_aug_path)
    test_real54_df = load_text_label(test_real54_path)
    test_df = pd.concat([test_aug_df, test_real54_df], ignore_index=True)
    test_df = test_df.drop_duplicates(subset=["text", "label"]).reset_index(drop=True)

    # Leakage guard 1: drop duplicates inside train by text only.
    train_df["text_key"] = train_df["text"].apply(canonicalize_text)
    test_df["text_key"] = test_df["text"].apply(canonicalize_text)
    train_df = train_df.drop_duplicates(subset=["text_key"]).reset_index(drop=True)
    test_df = test_df.drop_duplicates(subset=["text_key"]).reset_index(drop=True)

    # Leakage guard 2: remove any test-overlapping samples from train.
    overlap_keys = set(train_df["text_key"]).intersection(set(test_df["text_key"]))
    if overlap_keys:
        train_df = train_df[~train_df["text_key"].isin(overlap_keys)].reset_index(drop=True)

    # Clean helper column after leakage filtering.
    train_df = train_df.drop(columns=["text_key"])
    test_df = test_df.drop(columns=["text_key"])

    # Leakage guard 3: remove near-duplicate train texts vs test texts.
    train_df, removed_near_dup = remove_near_duplicate_train_rows(
        train_df,
        test_df,
        similarity_threshold=0.92,
    )

    print("=== Dataset Summary ===")
    print(f"Train source: {train_path}")
    print(f"Train samples: {len(train_df)}")
    print(train_df["label"].value_counts())
    print(f"\nTest source A: {test_aug_path}")
    print(f"Test source B: {test_real54_path}")
    print(f"Test samples: {len(test_df)}")
    print(test_df["label"].value_counts())
    print(f"Removed overlap samples from train: {len(overlap_keys)}")
    print(f"Removed near-duplicate train samples: {removed_near_dup}")

    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words="english",
        ngram_range=(1, 2),
        lowercase=True,
        min_df=2,
        max_df=0.95,
        sublinear_tf=True,
    )

    X_train = vectorizer.fit_transform(train_df["text"])
    X_test = vectorizer.transform(test_df["text"])
    y_train = train_df["label"]
    y_test = test_df["label"]

    print("\n=== TF-IDF Shapes ===")
    print(f"X_train: {X_train.shape}")
    print(f"X_test : {X_test.shape}")

    balanced = LogisticRegression(
        max_iter=1000, random_state=42, class_weight="balanced", C=0.5
    )
    balanced.fit(X_train, y_train)
    evaluate("Balanced LogisticRegression", balanced, X_train, y_train, X_test, y_test)


if __name__ == "__main__":
    main()
