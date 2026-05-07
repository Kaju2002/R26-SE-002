from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

try:
    from imblearn.over_sampling import SMOTE
except Exception:
    SMOTE = None


def main():
    p = Path(__file__).resolve().parents[1] / "data" / "phase1" / "stage1_cleaned_text_label.csv"
    df = pd.read_csv(p)[["text", "label"]].dropna()
    df["text"] = df["text"].astype(str).str.strip()
    df = df[df["text"] != ""]

    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
    )
    v = TfidfVectorizer(
        max_features=5000, stop_words="english", ngram_range=(1, 2), lowercase=True
    )
    Xtr = v.fit_transform(X_train)
    Xte = v.transform(X_test)

    m1 = LogisticRegression(max_iter=1000, random_state=42)
    m1.fit(Xtr, y_train)
    tr1, te1 = m1.score(Xtr, y_train), m1.score(Xte, y_test)
    print(f"Baseline -> Train: {tr1:.4f} | Test: {te1:.4f} | Gap: {tr1 - te1:.4f}")

    m2 = LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced")
    m2.fit(Xtr, y_train)
    tr2, te2 = m2.score(Xtr, y_train), m2.score(Xte, y_test)
    print(f"Balanced -> Train: {tr2:.4f} | Test: {te2:.4f} | Gap: {tr2 - te2:.4f}")

    if SMOTE is not None:
        sm = SMOTE(random_state=42)
        Xs, ys = sm.fit_resample(Xtr, y_train)
        m3 = LogisticRegression(max_iter=1000, random_state=42)
        m3.fit(Xs, ys)
        tr3, te3 = m3.score(Xs, ys), m3.score(Xte, y_test)
        print(f"SMOTE    -> Train: {tr3:.4f} | Test: {te3:.4f} | Gap: {tr3 - te3:.4f}")
    else:
        print("SMOTE    -> not available (install imbalanced-learn)")


if __name__ == "__main__":
    main()
