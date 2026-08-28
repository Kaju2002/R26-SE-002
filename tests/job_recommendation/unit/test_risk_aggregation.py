"""Unit tests for entropy-weighted risk aggregation."""

import pytest

from tests.service_imports import import_module

risk_aggregation = import_module("job-recommendation", "src.risk_aggregation")
run_risk_aggregation = risk_aggregation.run_risk_aggregation
run_risk_aggregation_from_rows = risk_aggregation.run_risk_aggregation_from_rows


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


def test_run_risk_aggregation_from_rows_matches_csv_fixture(mini_risk_path):
  csv_result, _ = run_risk_aggregation(str(mini_risk_path))
  rows = [
      {
          "job_id": 1,
          "fake_job_indicator": "Not Fake",
          "employer_indicator": "Legitimate Company",
          "comm_scam_indicator": "Not Scam",
      },
      {
          "job_id": 2,
          "fake_job_indicator": "Fake",
          "employer_indicator": "Fake Company",
          "comm_scam_indicator": "Scam",
      },
      {
          "job_id": 3,
          "fake_job_indicator": "Suspicious",
          "employer_indicator": "Legitimate Company",
          "comm_scam_indicator": "Not Scam",
      },
      {
          "job_id": 4,
          "fake_job_indicator": "Not Fake",
          "employer_indicator": "Legitimate Company",
          "comm_scam_indicator": "Not Scam",
      },
  ]
  memory_result, _ = run_risk_aggregation_from_rows(rows)

  assert len(memory_result) == len(csv_result)
  safest_csv = csv_result.loc[csv_result["job_id"] == 1].iloc[0]
  safest_memory = memory_result.loc[memory_result["job_id"] == 1].iloc[0]
  assert safest_memory["safety_score"] > 0.5
  assert safest_csv["safety_score"] == pytest.approx(safest_memory["safety_score"])
