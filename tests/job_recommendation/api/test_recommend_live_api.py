"""API smoke tests for POST /recommend/live (in-memory ranking)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from tests.service_imports import import_module

    jr_app = import_module("job-recommendation", "app")

    with TestClient(jr_app.app) as test_client:
        yield test_client


def test_recommend_live_success(client: TestClient, samples: dict):
    res = client.post(
        "/recommend/live",
        json={
            "skills": samples["user_skills"]["hr_profile"],
            "jobs": samples["live_jobs"],
            "limit": 2,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert body[0]["job_title"] == "HR Generalist"
    assert isinstance(body[0]["job_id"], str)


def test_recommend_live_rejects_empty_skills(client: TestClient, samples: dict):
    res = client.post(
        "/recommend/live",
        json={"skills": [], "jobs": samples["live_jobs"]},
    )
    assert res.status_code == 400
    assert "skill" in res.json()["detail"].lower()


def test_recommend_live_empty_jobs(client: TestClient, samples: dict):
    res = client.post(
        "/recommend/live",
        json={"skills": samples["user_skills"]["tech_profile"], "jobs": []},
    )
    assert res.status_code == 200
    assert res.json() == []
