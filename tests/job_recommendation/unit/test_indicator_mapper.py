"""Unit tests for indicator label mapping."""

from tests.service_imports import import_module

indicator_mapper = import_module("job-recommendation", "src.indicator_mapper")
job_to_indicator_row = indicator_mapper.job_to_indicator_row
map_fake_job = indicator_mapper.map_fake_job


def test_map_fake_job_predictions():
    assert map_fake_job("legitimate") == "Not Fake"
    assert map_fake_job("suspicious") == "Suspicious"
    assert map_fake_job("fake") == "Fake"
    assert map_fake_job(None) == "Not Fake"


def test_job_to_indicator_row_from_live_payload():
    row = job_to_indicator_row(
        {
            "id": "job-1",
            "isVerified": True,
            "riskPrediction": "suspicious",
            "commIsScam": False,
        }
    )

    assert row == {
        "job_id": "job-1",
        "fake_job_indicator": "Suspicious",
        "employer_indicator": "Legitimate Company",
        "comm_scam_indicator": "Not Scam",
    }


def test_job_to_indicator_row_reads_nested_risk_check():
    row = job_to_indicator_row(
        {
            "id": "job-2",
            "isVerified": False,
            "riskCheck": {"prediction": "fake"},
            "commIsScam": True,
        }
    )

    assert row["fake_job_indicator"] == "Fake"
    assert row["employer_indicator"] == "Fake Company"
    assert row["comm_scam_indicator"] == "Scam"
