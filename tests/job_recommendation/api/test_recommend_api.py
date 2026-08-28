"""
API smoke tests for POST /recommend (CSV pipeline mocked).
No full dataset required.
"""

from __future__ import annotations

import pandas as pd
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, samples: dict):
    import app as jr_app

    skill_df = pd.DataFrame(
        {
            "job_id": [101, 102],
            "job_title": ["HR Analyst", "Python Engineer"],
            "skill_match_score": [0.88, 0.42],
            "matched_skills": [["communication"], ["python"]],
            "matched_count": [1, 1],
            "job_skill_set": [
                "['communication', 'payroll']",
                "['python', 'django']",
            ],
        }
    )
    risk_df = pd.DataFrame(
        {
            "job_id": [101, 102],
            "risk_score": [0.15, 0.70],
            "safety_score": [0.85, 0.30],
        }
    )
    ranked = skill_df.merge(risk_df, on="job_id")
    ranked["topsis_score"] = [0.91, 0.35]

    monkeypatch.setattr(jr_app, "run_skill_matching", lambda _path, _skills: skill_df)
    monkeypatch.setattr(
        jr_app,
        "run_risk_aggregation",
        lambda _path: (risk_df, pd.Series({"fake_job_num": 0.33, "employer_num": 0.33, "comm_scam_num": 0.34})),
    )
    monkeypatch.setattr(jr_app, "run_ranking", lambda _skill, _risk: ranked.sort_values("topsis_score", ascending=False))

    with TestClient(jr_app.app) as test_client:
        yield test_client


def test_health_ok():
    import app as jr_app

    with TestClient(jr_app.app) as client:
        res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["service"] == "job-recommendation"


def test_recommend_success(client: TestClient, samples: dict):
    skills = samples["user_skills"]["hr_profile"]
    res = client.post("/recommend", json={"skills": skills})
    assert res.status_code == 200

    body = res.json()
    assert len(body) == 2
    assert body[0]["job_id"] == 101
    assert body[0]["job_title"] == "HR Analyst"
    assert body[0]["overall_fit"] == 0.91
    assert "skills_you_have" in body[0]
    assert "skills_to_develop" in body[0]


def test_recommend_response_keys(client: TestClient):
    res = client.post("/recommend", json={"skills": ["python"]})
    assert res.status_code == 200
    item = res.json()[0]
    for key in (
        "job_id",
        "job_title",
        "relevance",
        "trust_score",
        "overall_fit",
        "skills_you_have",
        "skills_to_develop",
    ):
        assert key in item
