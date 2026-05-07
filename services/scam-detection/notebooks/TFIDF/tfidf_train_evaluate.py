"""Stage 3: train + evaluate final selected model only."""

from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


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


def evaluate_model(model, x_train, y_train, x_test, y_test):
    y_pred = model.predict(x_test)
    train_acc = accuracy_score(y_train, model.predict(x_train))
    test_acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred, labels=["LEGIT", "SCAM"])

    print(f"Train accuracy: {train_acc:.4f}")
    print(f"Test accuracy : {test_acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, digits=4))
    print("Confusion Matrix (rows=true, cols=pred):")
    print(cm)


def main():
    project_root = Path(__file__).resolve().parents[2]
    train_df = load_text_label(project_root / "data" / "cleaned" / "cleaned_synthetic.csv")
    test_df = pd.concat(
        [
            load_text_label(project_root / "data" / "augmented" / "augmented_real_filtered.csv"),
            load_text_label(project_root / "data" / "augmented" / "real_messages_54.csv"),
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
    y_train = train_df["label"]
    y_test = test_df["label"]

    model = LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced", C=0.5)
    model.fit(x_train, y_train)
    evaluate_model(model, x_train, y_train, x_test, y_test)


if __name__ == "__main__":
    main()
