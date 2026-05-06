"""Stage 2: vectorize selected final datasets only."""

from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer


def normalize_label(v):
    try:
        n = float(v)
        if n == 1.0:
            return "SCAM"
        if n == 0.0:
            return "LEGIT"
    except (TypeError, ValueError):
        pass
    s = str(v).strip().lower()
    if s in {"scam", "fraud", "spam", "phishing"}:
        return "SCAM"
    if s in {"legit", "legitimate", "ham", "safe", "not scam"}:
        return "LEGIT"
    return None


def load_text_label(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)[["text", "label"]].dropna(subset=["text", "label"]).copy()
    df["text"] = df["text"].astype(str).str.strip()
    df = df[df["text"] != ""]
    df["label"] = df["label"].apply(normalize_label)
    return df[df["label"].isin(["SCAM", "LEGIT"])].reset_index(drop=True)


def main():
    root = Path(__file__).resolve().parents[2]
    train_df = load_text_label(root / "data" / "cleaned" / "cleaned_synthetic.csv")
    test_df = pd.concat(
        [
            load_text_label(root / "data" / "augmented" / "augmented_real_filtered.csv"),
            load_text_label(root / "data" / "augmented" / "real_messages_54.csv"),
        ],
        ignore_index=True,
    ).drop_duplicates(subset=["text", "label"]).reset_index(drop=True)

    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words="english",
        ngram_range=(1, 2),
        lowercase=True,
        min_df=2,
        max_df=0.95,
        sublinear_tf=True,
    )
    x_train = vectorizer.fit_transform(train_df["text"])
    x_test = vectorizer.transform(test_df["text"])

    print("Train samples:", len(train_df))
    print("Test samples :", len(test_df))
    print("X_train shape:", x_train.shape)
    print("X_test shape :", x_test.shape)
    print("Vocab size   :", len(vectorizer.vocabulary_))


if __name__ == "__main__":
    main()
