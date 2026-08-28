# Required libraries
import pandas as pd
import numpy as np

INDICATOR_MAPPING = {
    "Not Fake": 0,
    "Suspicious": 0.5,
    "Fake": 1,
    "Legitimate Company": 0,
    "Fake Company": 1,
    "Not Scam": 0,
    "Scam": 1,
}

INDICATOR_COLUMNS = ["fake_job_num", "employer_num", "comm_scam_num"]


def _apply_indicator_mapping(risk_data: pd.DataFrame) -> pd.DataFrame:
    risk_data = risk_data.copy()
    risk_data["fake_job_num"] = risk_data["fake_job_indicator"].map(INDICATOR_MAPPING)
    risk_data["employer_num"] = risk_data["employer_indicator"].map(INDICATOR_MAPPING)
    risk_data["comm_scam_num"] = risk_data["comm_scam_indicator"].map(INDICATOR_MAPPING)
    return risk_data


def _compute_ewm_scores(risk_data: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Entropy Weight Method over the three risk indicator columns."""
    risk_data = _apply_indicator_mapping(risk_data)
    indicators = risk_data[INDICATOR_COLUMNS]

    if len(indicators) == 0:
        empty = risk_data[["job_id"]].copy()
        empty["risk_score"] = []
        empty["safety_score"] = []
        weights = pd.Series([1 / 3, 1 / 3, 1 / 3], index=INDICATOR_COLUMNS)
        return empty, weights

    if len(indicators) == 1:
        weights = pd.Series([1 / 3, 1 / 3, 1 / 3], index=INDICATOR_COLUMNS)
    else:
        normalized = (indicators - indicators.min()) / (indicators.max() - indicators.min())
        normalized = normalized.fillna(0)

        proportions = normalized / normalized.sum()
        proportions = proportions.replace(0, 1e-10)

        n_rows = len(indicators)
        k = 1 / np.log(n_rows)
        entropy = -k * (proportions * np.log(proportions)).sum()

        d = 1 - entropy
        weights = d / d.sum()

    risk_data["risk_score"] = (
        risk_data["fake_job_num"] * weights["fake_job_num"]
        + risk_data["employer_num"] * weights["employer_num"]
        + risk_data["comm_scam_num"] * weights["comm_scam_num"]
    )
    risk_data["safety_score"] = 1 - risk_data["risk_score"]

    return risk_data[["job_id", "risk_score", "safety_score"]], weights


def run_risk_aggregation_from_rows(rows: list[dict]) -> tuple[pd.DataFrame, pd.Series]:
    """
    Run risk aggregation from in-memory indicator rows.

    Each row must include:
        job_id, fake_job_indicator, employer_indicator, comm_scam_indicator
    """
    if not rows:
        empty = pd.DataFrame(columns=["job_id", "risk_score", "safety_score"])
        weights = pd.Series([1 / 3, 1 / 3, 1 / 3], index=INDICATOR_COLUMNS)
        return empty, weights

    risk_data = pd.DataFrame(rows)
    return _compute_ewm_scores(risk_data)


def run_risk_aggregation(risk_path):
    """
    Run the risk aggregation module using Entropy Weight Method.

    Parameters:
        risk_path: path to risk_indicators.csv

    Returns:
        DataFrame with job_id, risk_score, safety_score, and weights
    """
    risk_data = pd.read_csv(risk_path)
    return _compute_ewm_scores(risk_data)


# Standalone test
if __name__ == "__main__":
    result, weights = run_risk_aggregation("data/raw/risk_indicators.csv")

    print("--- EWM Weights ---")
    print(f"Fake Job Detection: {weights['fake_job_num']:.4f}")
    print(f"Employer Legitimacy: {weights['employer_num']:.4f}")
    print(f"Communication Scam: {weights['comm_scam_num']:.4f}")

    print("\n--- Risk vs Safety Scores (first 10 jobs) ---")
    print(result.head(10))
