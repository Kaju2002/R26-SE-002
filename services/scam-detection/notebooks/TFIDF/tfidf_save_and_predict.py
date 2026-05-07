"""Stage 4: save final balanced TF-IDF + Logistic model."""

from pathlib import Path
import joblib
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


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


def build_and_train_model(df: pd.DataFrame):
    """Train vectorizer + balanced logistic regression and return both."""
    x = df["text"]
    y = df["label"]

    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words="english",
        ngram_range=(1, 2),
        lowercase=True,
        min_df=2,
        max_df=0.95,
        sublinear_tf=True,
    )

    x_train_tfidf = vectorizer.fit_transform(x)

    # Using balanced model chosen from Stage 3 comparison.
    model = LogisticRegression(
        max_iter=1000,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(x_train_tfidf, y)

    return model, vectorizer


def predict_message(text: str, model, vectorizer):
    """
    Predict one message and return:
    - predicted class: SCAM or LEGIT
    - confidence score for predicted class (0-1)
    """
    if not isinstance(text, str) or text.strip() == "":
        raise ValueError("Input text must be a non-empty string.")

    text_vector = vectorizer.transform([text])
    predicted_label = model.predict(text_vector)[0]
    probabilities = model.predict_proba(text_vector)[0]

    class_to_prob = dict(zip(model.classes_, probabilities))
    confidence = float(class_to_prob[predicted_label])

    output_label = "SCAM" if str(predicted_label).upper() == "SCAM" else "LEGIT"
    return output_label, confidence


def main():
    project_root = Path(__file__).resolve().parents[2]
    models_dir = project_root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    df = load_text_label(project_root / "data" / "cleaned" / "cleaned_synthetic.csv")
    model, vectorizer = build_and_train_model(df)

    # Save artifacts for reuse.
    model_path = models_dir / "scam_classifier_logreg_balanced.joblib"
    vectorizer_path = models_dir / "tfidf_vectorizer.joblib"
    joblib.dump(model, model_path)
    joblib.dump(vectorizer, vectorizer_path)

    print(f"\nSaved model to: {model_path}")
    print(f"Saved vectorizer to: {vectorizer_path}")

    # Demo examples (obvious scam, obvious legit, borderline).
    demo_messages = [
        "Urgent! Pay LKR 7500 now for document clearance or your job visa will be cancelled today.",
        "Hi, your interview is scheduled for Monday at 10 AM. Please bring your ID and updated CV.",
        "To complete onboarding, a small processing fee may apply depending on verification status.",
    ]

    print("\n=== Demo Predictions ===")
    for idx, message in enumerate(demo_messages, start=1):
        label, confidence = predict_message(message, model, vectorizer)
        print(f"\nExample {idx}:")
        print(f"Message: {message}")
        print(f"Prediction: {label}")
        print(f"Confidence: {confidence:.4f}")


if __name__ == "__main__":
    main()
