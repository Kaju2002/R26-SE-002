"""
Robust evaluation for TF-IDF + Logistic Regression:
1) Train data: cleaned_synthetic.csv
2) External test data: augmented_real_filtered.csv + real_messages_54.csv
3) 5-fold CV on train for generalization estimate
4) Validation split for threshold tuning (SCAM probability cutoff)
"""

from pathlib import Path
import numpy as np
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    make_scorer,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split


def normalize_label(label_value):
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
    if not csv_path.exists():
        raise FileNotFoundError(f"Missing dataset: {csv_path}")

    df = pd.read_csv(csv_path)
    df = df[["text", "label"]].dropna(subset=["text", "label"]).copy()
    df["text"] = df["text"].astype(str).str.strip()
    df = df[df["text"] != ""]
    df["label"] = df["label"].apply(normalize_label)
    df = df[df["label"].isin(["SCAM", "LEGIT"])].reset_index(drop=True)
    return df


def evaluate_external(name, y_true, y_pred):
    acc = accuracy_score(y_true, y_pred)
    scam_f1 = f1_score(y_true, y_pred, pos_label="SCAM")
    cm = confusion_matrix(y_true, y_pred, labels=["LEGIT", "SCAM"])
    print(f"\n===== {name} =====")
    print(f"External Test Accuracy: {acc:.4f}")
    print(f"External Test SCAM F1 : {scam_f1:.4f}")
    print("Confusion Matrix (rows=true, cols=pred):")
    print(cm)
    print("\nClassification Report:")
    print(classification_report(y_true, y_pred, digits=4))
    return acc, scam_f1


def main():
    project_root = Path(__file__).resolve().parents[2]
    train_path = project_root / "data" / "cleaned" / "cleaned_synthetic.csv"
    test_aug_path = project_root / "data" / "augmented" / "augmented_real_filtered.csv"
    test_real54_path = project_root / "data" / "augmented" / "real_messages_54.csv"

    train_df = load_text_label(train_path)
    test_df = pd.concat(
        [load_text_label(test_aug_path), load_text_label(test_real54_path)],
        ignore_index=True,
    ).drop_duplicates(subset=["text", "label"]).reset_index(drop=True)

    print("=== Data Summary ===")
    print(f"Train samples: {len(train_df)}")
    print(train_df["label"].value_counts())
    print(f"\nExternal test samples: {len(test_df)}")
    print(test_df["label"].value_counts())

    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words="english",
        ngram_range=(1, 2),
        lowercase=True,
        min_df=2,
        max_df=0.95,
        sublinear_tf=True,
    )

    X_train_all = vectorizer.fit_transform(train_df["text"])
    y_train_all = train_df["label"].values
    X_test_ext = vectorizer.transform(test_df["text"])
    y_test_ext = test_df["label"].values

    # 1) 5-fold CV on training set
    cv_model = LogisticRegression(
        max_iter=1000,
        random_state=42,
        class_weight="balanced",
        C=0.5,
    )
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scoring = {
        "accuracy": "accuracy",
        "f1_scam": make_scorer(f1_score, pos_label="SCAM"),
    }
    cv_scores = cross_validate(cv_model, X_train_all, y_train_all, cv=skf, scoring=scoring)

    print("\n=== 5-Fold CV on Train (Balanced Logistic) ===")
    print(f"CV Accuracy mean ± std: {cv_scores['test_accuracy'].mean():.4f} ± {cv_scores['test_accuracy'].std():.4f}")
    print(f"CV SCAM F1 mean ± std : {cv_scores['test_f1_scam'].mean():.4f} ± {cv_scores['test_f1_scam'].std():.4f}")

    # 2) Threshold tuning using a validation split from training data
    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train_all,
        y_train_all,
        test_size=0.2,
        random_state=42,
        stratify=y_train_all,
    )

    tune_model = LogisticRegression(
        max_iter=1000,
        random_state=42,
        class_weight="balanced",
        C=0.5,
    )
    tune_model.fit(X_tr, y_tr)
    val_probs = tune_model.predict_proba(X_val)
    scam_idx = list(tune_model.classes_).index("SCAM")

    best_threshold = 0.5
    best_val_f1 = -1.0
    for threshold in np.arange(0.30, 0.91, 0.02):
        val_pred = np.where(val_probs[:, scam_idx] >= threshold, "SCAM", "LEGIT")
        f1 = f1_score(y_val, val_pred, pos_label="SCAM")
        if f1 > best_val_f1:
            best_val_f1 = f1
            best_threshold = float(threshold)

    print("\n=== Threshold Tuning (validation split) ===")
    print(f"Best SCAM threshold: {best_threshold:.2f}")
    print(f"Validation SCAM F1 : {best_val_f1:.4f}")

    # 3) Train final model on full training data
    final_model = LogisticRegression(
        max_iter=1000,
        random_state=42,
        class_weight="balanced",
        C=0.5,
    )
    final_model.fit(X_train_all, y_train_all)

    # Default threshold (0.5)
    ext_probs = final_model.predict_proba(X_test_ext)
    default_pred = np.where(ext_probs[:, scam_idx] >= 0.5, "SCAM", "LEGIT")
    evaluate_external("External Test @ threshold 0.50", y_test_ext, default_pred)

    # Tuned threshold
    tuned_pred = np.where(ext_probs[:, scam_idx] >= best_threshold, "SCAM", "LEGIT")
    evaluate_external(f"External Test @ tuned threshold {best_threshold:.2f}", y_test_ext, tuned_pred)


if __name__ == "__main__":
    main()
