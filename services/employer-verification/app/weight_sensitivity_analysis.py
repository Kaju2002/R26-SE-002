"""Weight sensitivity analysis for the employer legitimacy score.

This script is intended for PP2 evidence. It evaluates several weight
profiles against a labeled dataset and reports how accuracy, precision,
recall, and F1 change when the final risk score is reweighted.

Expected input schema:
    raw employer-verification dataset with columns such as:
    label, company_name, website_url, is_registered, review_score,
    review_count, has_glassdoor, has_indeed, has_trustpilot,
    has_positive_reviews, has_negative_reviews, has_https, has_about,
    has_contact, has_privacy_policy, has_terms, has_payment_risk,
    has_urgency_language, content_score, scam_score, trust_score,
    suspicion_score, website_alive, valid_website, is_http_only,
    has_suspicious_tld, domain_age_days.

The script derives the four PP2 component scores automatically:
    p_ml, r_registry, r_reputation, r_website.

If the trained model artifact is available, p_ml is taken from the model's
legitimacy probability. Otherwise, it falls back to a feature-based proxy.

Example:
    python -m app.weight_sensitivity_analysis --input-csv data/employer_eval.csv
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix


SERVICE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = SERVICE_ROOT / "models" / "final_realistic_model.pkl"


@dataclass(frozen=True)
class WeightProfile:
    name: str
    w_ml: float
    w_registry: float
    w_reputation: float
    w_website: float

    def as_tuple(self) -> Tuple[float, float, float, float]:
        return (self.w_ml, self.w_registry, self.w_reputation, self.w_website)


PROFILES: List[WeightProfile] = [
    WeightProfile("Proposed Baseline", 0.40, 0.30, 0.20, 0.10),
    WeightProfile("ML-Dominant", 0.70, 0.10, 0.10, 0.10),
    WeightProfile("Registry-Heavy", 0.20, 0.60, 0.10, 0.10),
    WeightProfile("Equal Weights", 0.25, 0.25, 0.25, 0.25),
    WeightProfile("Reputation-Ignored", 0.50, 0.40, 0.00, 0.10),
]


def _pick_column(df: pd.DataFrame, candidates: Sequence[str], required: bool = True) -> Optional[str]:
    for column_name in candidates:
        if column_name in df.columns:
            return column_name
    if required:
        raise KeyError(f"None of the required columns were found: {list(candidates)}")
    return None


def _normalize_series(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce").fillna(0.0).astype(float)
    if values.max() > 1.0:
        values = values / 100.0
    return values.clip(0.0, 1.0)


def _scale_with_cap(series: pd.Series, cap: float) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce").fillna(0.0).astype(float)
    if cap <= 0:
        return pd.Series(np.zeros(len(values)), index=series.index)
    return (values / cap).clip(0.0, 1.0)


def _safe_col(df: pd.DataFrame, column_name: str, default: float = 0.0) -> pd.Series:
    if column_name in df.columns:
        return pd.to_numeric(df[column_name], errors="coerce").fillna(default)
    return pd.Series([default] * len(df), index=df.index, dtype=float)


def _binary_col(df: pd.DataFrame, column_name: str) -> pd.Series:
    return _safe_col(df, column_name, 0.0).clip(0.0, 1.0)


def _derive_reputation_score(df: pd.DataFrame) -> pd.Series:
    review_score = _normalize_series(_safe_col(df, "review_score", 0.0))
    review_count = _scale_with_cap(_safe_col(df, "review_count", 0.0), cap=20.0)
    glassdoor = _binary_col(df, "has_glassdoor")
    indeed = _binary_col(df, "has_indeed")
    trustpilot = _binary_col(df, "has_trustpilot")
    positive_reviews = _binary_col(df, "has_positive_reviews")
    negative_reviews = _binary_col(df, "has_negative_reviews")

    score = (
        0.35 * review_score
        + 0.20 * review_count
        + 0.15 * glassdoor
        + 0.15 * indeed
        + 0.10 * trustpilot
        + 0.10 * positive_reviews
        - 0.15 * negative_reviews
    )
    return score.clip(0.0, 1.0)


def _derive_website_score(df: pd.DataFrame) -> pd.Series:
    has_https = _binary_col(df, "has_https")
    has_about = _binary_col(df, "has_about")
    has_contact = _binary_col(df, "has_contact")
    has_privacy_policy = _binary_col(df, "has_privacy_policy")
    has_terms = _binary_col(df, "has_terms")
    website_alive = _binary_col(df, "website_alive")
    valid_website = _binary_col(df, "valid_website")
    is_http_only = _binary_col(df, "is_http_only")
    has_suspicious_tld = _binary_col(df, "has_suspicious_tld")
    has_payment_risk = _binary_col(df, "has_payment_risk")
    has_urgency_language = _binary_col(df, "has_urgency_language")
    trust_score = _normalize_series(_safe_col(df, "trust_score", 0.0))
    suspicion_score = _normalize_series(_safe_col(df, "suspicion_score", 0.0))
    content_score = _normalize_series(_safe_col(df, "content_score", 0.0))

    score = (
        0.12 * has_https
        + 0.10 * has_about
        + 0.10 * has_contact
        + 0.08 * has_privacy_policy
        + 0.08 * has_terms
        + 0.08 * website_alive
        + 0.08 * valid_website
        + 0.10 * content_score
        + 0.16 * trust_score
        + 0.10 * (1.0 - suspicion_score)
        + 0.05 * (1.0 - has_payment_risk)
        + 0.03 * (1.0 - has_urgency_language)
        + 0.02 * (1.0 - is_http_only)
        + 0.02 * (1.0 - has_suspicious_tld)
    )
    return score.clip(0.0, 1.0)


def _derive_registry_score(df: pd.DataFrame) -> pd.Series:
    registry = _binary_col(df, "is_registered")
    domain_age = _normalize_series(_safe_col(df, "domain_age_days", 0.0))
    # Registration is the main signal. Domain age is only a small stabilizer.
    score = (0.90 * registry + 0.10 * domain_age).clip(0.0, 1.0)
    return score


def _load_model_bundle(model_path: Path = DEFAULT_MODEL_PATH) -> Optional[dict]:
    if not model_path.exists():
        return None

    try:
        import joblib

        return joblib.load(model_path)
    except Exception:
        return None


def _derive_ml_probability(df: pd.DataFrame) -> pd.Series:
    """Return legitimacy probability in [0, 1].

    Preference order:
    1. Trained model probability if the artifact is available.
    2. A transparent proxy from the raw signals when the artifact is missing.
    """
    bundle = _load_model_bundle()
    if bundle is not None and "model" in bundle and "features" in bundle:
        model = bundle["model"]
        feature_cols = list(bundle["features"])
        feature_frame = pd.DataFrame(index=df.index)

        for column_name in feature_cols:
            if column_name in df.columns:
                feature_frame[column_name] = pd.to_numeric(df[column_name], errors="coerce").fillna(0.0)
            else:
                feature_frame[column_name] = 0.0

        predictions = model.predict_proba(feature_frame.fillna(0.0))
        if predictions.shape[1] == 2:
            return pd.Series(predictions[:, 1], index=df.index).clip(0.0, 1.0)

        # Fallback in the rare case the estimator does not expose two classes.
        return pd.Series(model.predict(feature_frame.fillna(0.0)), index=df.index).clip(0.0, 1.0)

    # Transparent fallback proxy built from the raw features.
    trust_score = _normalize_series(_safe_col(df, "trust_score", 0.0))
    suspicion_score = _normalize_series(_safe_col(df, "suspicion_score", 0.0))
    content_score = _normalize_series(_safe_col(df, "content_score", 0.0))
    has_https = _binary_col(df, "has_https")
    has_about = _binary_col(df, "has_about")
    has_contact = _binary_col(df, "has_contact")
    has_privacy_policy = _binary_col(df, "has_privacy_policy")
    has_terms = _binary_col(df, "has_terms")
    has_payment_risk = _binary_col(df, "has_payment_risk")
    has_urgency_language = _binary_col(df, "has_urgency_language")
    website_alive = _binary_col(df, "website_alive")

    proxy = (
        0.20 * trust_score
        + 0.20 * content_score
        + 0.12 * has_https
        + 0.10 * has_about
        + 0.10 * has_contact
        + 0.08 * has_privacy_policy
        + 0.08 * has_terms
        + 0.06 * website_alive
        + 0.03 * (1.0 - suspicion_score)
        + 0.02 * (1.0 - has_payment_risk)
        + 0.01 * (1.0 - has_urgency_language)
    )
    return proxy.clip(0.0, 1.0)


def load_dataset(input_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(input_csv)

    label_col = _pick_column(df, ["label", "ground_truth", "y_true"])
    normalized = pd.DataFrame(index=df.index)
    normalized["company_name"] = df["company_name"] if "company_name" in df.columns else [f"row_{i}" for i in range(len(df))]
    normalized["label"] = pd.to_numeric(df[label_col], errors="coerce").fillna(0).astype(int)
    normalized["p_ml"] = _derive_ml_probability(df)
    normalized["r_registry"] = _derive_registry_score(df)
    normalized["r_reputation"] = _derive_reputation_score(df)
    normalized["r_website"] = _derive_website_score(df)

    normalized["source_model_path"] = str(DEFAULT_MODEL_PATH)
    return normalized


def score_rows(df: pd.DataFrame, profile: WeightProfile) -> pd.DataFrame:
    score = (
        profile.w_ml * df["p_ml"]
        + profile.w_registry * df["r_registry"]
        + profile.w_reputation * df["r_reputation"]
        + profile.w_website * df["r_website"]
    ) * 100.0

    predicted = np.where(score >= 45.0, 1, 0)

    result = df.copy()
    result["score"] = score
    result["predicted_label"] = predicted
    result["risk_band"] = np.where(score >= 70.0, "Low Risk", np.where(score >= 45.0, "Medium Risk", "High Risk"))
    return result


def evaluate_profile(df: pd.DataFrame, profile: WeightProfile) -> Dict[str, float]:
    scored = score_rows(df, profile)
    y_true = scored["label"]
    y_pred = scored["predicted_label"]
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fraud_recall = recall_score(y_true, y_pred, pos_label=0, zero_division=0)
    false_positive_rate = fp / (fp + tn) if (fp + tn) else 0.0

    return {
        "Profile": profile.name,
        "Weights (ML/Registry/Reputation/Website)": f"{profile.w_ml:.2f} / {profile.w_registry:.2f} / {profile.w_reputation:.2f} / {profile.w_website:.2f}",
        "Accuracy": round(accuracy_score(y_true, y_pred), 4),
        "Precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "Recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
        "F1-Score": round(f1_score(y_true, y_pred, zero_division=0), 4),
        "Fraud Recall": round(fraud_recall, 4),
        "False Positive Rate": round(false_positive_rate, 4),
    }


def evaluate_profiles(df: pd.DataFrame, profiles: Iterable[WeightProfile]) -> pd.DataFrame:
    rows = [evaluate_profile(df, profile) for profile in profiles]
    return pd.DataFrame(rows)


def grid_search_weights(df: pd.DataFrame, step: float = 0.05) -> pd.DataFrame:
    rows: List[Dict[str, float]] = []
    grid = np.arange(0.0, 1.0 + 1e-9, step)

    for w_ml in grid:
        for w_registry in grid:
            for w_reputation in grid:
                w_website = 1.0 - (w_ml + w_registry + w_reputation)
                if w_website < -1e-9 or w_website > 1.0:
                    continue
                if abs((w_ml + w_registry + w_reputation + w_website) - 1.0) > 1e-9:
                    continue

                profile = WeightProfile("candidate", float(w_ml), float(w_registry), float(w_reputation), float(w_website))
                metrics = evaluate_profile(df, profile)
                metrics.update(
                    {
                        "w_ml": round(profile.w_ml, 4),
                        "w_registry": round(profile.w_registry, 4),
                        "w_reputation": round(profile.w_reputation, 4),
                        "w_website": round(profile.w_website, 4),
                    }
                )
                rows.append(metrics)

    grid_df = pd.DataFrame(rows)
    if not grid_df.empty:
        grid_df = grid_df.sort_values(["F1-Score", "Recall", "Accuracy"], ascending=False).reset_index(drop=True)
    return grid_df


def select_edge_cases(df: pd.DataFrame, profiles: Sequence[WeightProfile], max_cases: int = 3) -> pd.DataFrame:
    """Select rows whose risk band changes the most across profiles.

    This gives the panel concrete evidence that the weights matter.
    """
    scored_profiles = []
    for profile in profiles:
        scored = score_rows(df, profile)[["company_name", "score", "risk_band"]].rename(
            columns={"score": f"score__{profile.name}", "risk_band": f"band__{profile.name}"}
        )
        scored_profiles.append(scored)

    merged = df[["company_name", "label", "p_ml", "r_registry", "r_reputation", "r_website"]].copy()
    for scored in scored_profiles:
        merged = merged.merge(scored, on="company_name", how="left")

    band_cols = [column_name for column_name in merged.columns if column_name.startswith("band__")]
    score_cols = [column_name for column_name in merged.columns if column_name.startswith("score__")]

    def band_variability(row: pd.Series) -> int:
        return len(set(row[column_name] for column_name in band_cols))

    def score_range(row: pd.Series) -> float:
        values = [float(row[column_name]) for column_name in score_cols if pd.notna(row[column_name])]
        return float(max(values) - min(values)) if values else 0.0

    merged["band_variability"] = merged.apply(band_variability, axis=1)
    merged["score_range"] = merged.apply(score_range, axis=1)

    selected = merged.sort_values(["band_variability", "score_range"], ascending=False).head(max_cases)
    return selected


def build_demo_dataset() -> pd.DataFrame:
    """Small manual set for demonstration when no CSV is available."""
    return pd.DataFrame(
        [
            {"company_name": "Hidden SME", "label": 1, "p_ml": 0.58, "r_registry": 0.00, "r_reputation": 0.82, "r_website": 0.76},
            {"company_name": "Sophisticated Scam", "label": 0, "p_ml": 0.41, "r_registry": 0.05, "r_reputation": 0.22, "r_website": 0.89},
            {"company_name": "Unverifiable Startup", "label": 1, "p_ml": 0.69, "r_registry": 0.10, "r_reputation": 0.12, "r_website": 0.71},
            {"company_name": "Verified Employer", "label": 1, "p_ml": 0.91, "r_registry": 1.00, "r_reputation": 0.73, "r_website": 0.84},
            {"company_name": "Clear Fraud", "label": 0, "p_ml": 0.18, "r_registry": 0.00, "r_reputation": 0.05, "r_website": 0.11},
        ]
    )


def print_table(df: pd.DataFrame, title: str) -> None:
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)
    if df.empty:
        print("No rows available.")
    else:
        print(df.to_string(index=False))


def _percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def _format_profile_table(df: pd.DataFrame) -> pd.DataFrame:
    formatted = df.copy()
    for column_name in ["Accuracy", "Precision", "Recall", "F1-Score", "Fraud Recall", "False Positive Rate"]:
        if column_name in formatted.columns:
            formatted[column_name] = formatted[column_name].apply(_percent)
    return formatted


def _format_grid_table(df: pd.DataFrame) -> pd.DataFrame:
    formatted = df.copy()
    for column_name in ["Accuracy", "Precision", "Recall", "F1-Score", "Fraud Recall", "False Positive Rate"]:
        if column_name in formatted.columns:
            formatted[column_name] = formatted[column_name].apply(_percent)
    if "Weights (ML/Registry/Reputation/Website)" in formatted.columns:
        formatted["Weights"] = formatted["Weights (ML/Registry/Reputation/Website)"]
        formatted = formatted.drop(columns=["Weights (ML/Registry/Reputation/Website)"])
    return formatted


def _format_edge_case_table(df: pd.DataFrame) -> pd.DataFrame:
    formatted = df.copy()
    for column_name in ["p_ml", "r_registry", "r_reputation", "r_website"]:
        if column_name in formatted.columns:
            formatted[column_name] = formatted[column_name].apply(_percent)
    for column_name in ["score_range"] + [c for c in formatted.columns if c.startswith("score__")]:
        if column_name in formatted.columns:
            formatted[column_name] = formatted[column_name].map(lambda v: f"{float(v):.1f}")
    return formatted


def _print_block(title: str, lines: Sequence[str]) -> None:
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)
    for line in lines:
        print(line)


def main() -> None:
    parser = argparse.ArgumentParser(description="Employer legitimacy weight sensitivity analysis")
    parser.add_argument("--input-csv", type=Path, help="CSV file containing label and component score columns")
    parser.add_argument("--output-dir", type=Path, default=Path("analysis_output"), help="Directory for generated CSV reports")
    parser.add_argument("--grid-step", type=float, default=0.05, help="Step size for grid search")
    parser.add_argument("--demo", action="store_true", help="Run on a small built-in demo dataset")
    args = parser.parse_args()

    if args.demo:
        df = build_demo_dataset()
        source_label = "built-in demo dataset"
    elif args.input_csv:
        df = load_dataset(args.input_csv)
        source_label = str(args.input_csv)
    else:
        raise SystemExit("Provide --input-csv or use --demo.")

    args.output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loaded dataset from: {source_label}")
    print(f"Rows: {len(df)}")
    print(f"Legitimate: {(df['label'] == 1).sum()} | Fraudulent: {(df['label'] == 0).sum()}")
    print(f"ML probability source: {'trained model' if DEFAULT_MODEL_PATH.exists() else 'raw-feature proxy fallback'}")
    print("Note: scores are shown as percentages; the final cutoff is 45% for Legitimate vs Fraudulent.")

    profile_results = evaluate_profiles(df, PROFILES)
    print_table(_format_profile_table(profile_results), "EXPERIMENT 1: PREDEFINED WEIGHT PROFILES")
    profile_results.to_csv(args.output_dir / "weight_profile_comparison.csv", index=False)
    # Clear percent table for Excel / viva (decimals are hard to read)
    _clear = profile_results.copy()
    for _col in ("Accuracy", "Precision", "Recall", "F1-Score", "Fraud Recall", "False Positive Rate"):
        if _col in _clear.columns:
            _clear[_col] = _clear[_col].map(lambda v: f"{float(v) * 100:.1f}%")
    _parts = _clear["Weights (ML/Registry/Reputation/Website)"].str.split("/", expand=True)
    if _parts.shape[1] == 4:
        _clear.insert(1, "ML %", _parts[0].str.strip().map(lambda s: f"{float(s) * 100:.0f}%"))
        _clear.insert(2, "Registry %", _parts[1].str.strip().map(lambda s: f"{float(s) * 100:.0f}%"))
        _clear.insert(3, "Reputation %", _parts[2].str.strip().map(lambda s: f"{float(s) * 100:.0f}%"))
        _clear.insert(4, "Website %", _parts[3].str.strip().map(lambda s: f"{float(s) * 100:.0f}%"))
    _clear.to_csv(args.output_dir / "weight_profile_comparison_clear.csv", index=False)
    (args.output_dir / "weight_sensitivity_report.txt").write_text(
        "WEIGHT PROFILE COMPARISON (clear table)\n"
        + "=" * 100
        + "\n"
        + _clear.to_string(index=False)
        + "\n",
        encoding="utf-8",
    )
    print(f"Clear profile table saved: {args.output_dir / 'weight_profile_comparison_clear.csv'}")
    print(f"Text table saved: {args.output_dir / 'weight_sensitivity_report.txt'}")

    grid_results = grid_search_weights(df, step=args.grid_step)
    top_grid = grid_results.head(10)[["Weights (ML/Registry/Reputation/Website)", "Accuracy", "Precision", "Recall", "F1-Score", "Fraud Recall", "False Positive Rate"]]
    print_table(_format_grid_table(top_grid), "EXPERIMENT 2: TOP GRID-SEARCH RESULTS")
    grid_results.to_csv(args.output_dir / "weight_grid_search.csv", index=False)

    edge_cases = select_edge_cases(df, PROFILES, max_cases=3)
    score_cols = [column_name for column_name in edge_cases.columns if column_name.startswith("score__")]
    band_cols = [column_name for column_name in edge_cases.columns if column_name.startswith("band__")]
    edge_case_cols = ["company_name", "label", "p_ml", "r_registry", "r_reputation", "r_website", "band_variability", "score_range"]
    print_table(_format_edge_case_table(edge_cases[edge_case_cols + score_cols + band_cols]), "EXPERIMENT 3: EDGE CASES SHOWING WEIGHT IMPACT")
    edge_cases.to_csv(args.output_dir / "edge_case_samples.csv", index=False)

    best_grid = grid_results.head(1)
    if not best_grid.empty:
        best = best_grid.iloc[0]
        best_lines = [
            f"Best weights : ({best['w_ml']:.2f}, {best['w_registry']:.2f}, {best['w_reputation']:.2f}, {best['w_website']:.2f})",
            f"Accuracy     : {_percent(float(best['Accuracy']))}",
            f"Precision    : {_percent(float(best['Precision']))}",
            f"Recall       : {_percent(float(best['Recall']))}",
            f"F1-score     : {_percent(float(best['F1-Score']))}",
            f"Fraud Recall : {_percent(float(best['Fraud Recall']))}",
            f"FPR          : {_percent(float(best['False Positive Rate']))}",
            "Note: grid-search best is metric-only; product baseline remains 40/30/20/10.",
        ]
        _print_block("BEST GRID-SEARCH PROFILE", best_lines)


if __name__ == "__main__":
    main()