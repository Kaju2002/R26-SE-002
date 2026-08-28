"""
API smoke tests for employer-verification POST /predict (mocked feature extract).
No real .pkl or network required.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, feature_cols: list[str]):
    import main as ev_main

    def fake_extract(input):
        company = (input.company_name or "Test Company").strip()
        features = {col: 0 for col in feature_cols}
        features["has_https"] = 1
        features["has_about"] = 1
        features["has_contact"] = 1
        info = []
        if input.company_name:
            info.append("company_name")
        if input.website_url:
            info.append("website_url")
        if input.email:
            info.append("email")
        reg = {
            "government_registration_status": "registered",
            "is_cse_listed": 1,
        }
        rep = {"has_linkedin": 1, "has_indeed": 1}
        url = input.website_url or "https://example.lk"
        return features, info, reg, rep, url, company

    monkeypatch.setattr(ev_main, "extract_features_from_input", fake_extract)
    with TestClient(ev_main.app) as test_client:
        yield test_client


def test_root_ok(client: TestClient):
    res = client.get("/")
    assert res.status_code == 200


def test_predict_success(client: TestClient, samples: dict):
    company = samples["companies"][0]
    res = client.post(
        "/predict",
        json={
            "company_name": company["company_name"],
            "website_url": company["website_url"],
            "email": company["email"],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["prediction"] in ("Legit", "Fake", "Unknown")
    assert "risk_score" in body
    assert "risk_level" in body
    assert "verdict" in body
    assert "score_breakdown" in body
    assert body["risk_level"] in ("Low", "Medium", "High")


def test_predict_minimal_company_name(client: TestClient):
    res = client.post("/predict", json={"company_name": "Virtusa Pvt Ltd"})
    assert res.status_code == 200
    body = res.json()
    assert body["prediction"] != "Unknown"


def test_predict_unknown_when_no_input(client: TestClient):
    res = client.post("/predict", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["prediction"] == "Unknown"
    assert body["confidence"] == "low"
