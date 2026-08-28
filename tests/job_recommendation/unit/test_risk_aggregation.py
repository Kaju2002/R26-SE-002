"""Unit tests for entropy-weighted risk aggregation."""

from src.risk_aggregation import run_risk_aggregation


def test_run_risk_aggregation_returns_expected_columns(mini_risk_path):
    result, weights = run_risk_aggregation(str(mini_risk_path))

    assert list(result.columns) == ["job_id", "risk_score", "safety_score"]
    assert len(result) == 4
    for col in ("fake_job_num", "employer_num", "comm_scam_num"):
        assert col in weights.index


def test_safest_job_has_highest_safety_score(mini_risk_path):
    result, _ = run_risk_aggregation(str(mini_risk_path))
    safest = result.loc[result["job_id"] == 1].iloc[0]
    riskiest = result.loc[result["job_id"] == 2].iloc[0]

    assert safest["safety_score"] > riskiest["safety_score"]
    assert riskiest["risk_score"] > safest["risk_score"]


def test_safety_is_inverse_of_risk(mini_risk_path):
    result, _ = run_risk_aggregation(str(mini_risk_path))
    for _, row in result.iterrows():
        assert abs((row["risk_score"] + row["safety_score"]) - 1.0) < 1e-9
