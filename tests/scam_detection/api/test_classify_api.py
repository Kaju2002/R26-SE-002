"""
API smoke tests for scam-detection with mocked model + DB.
No model weights required.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    import app.database as database
    import app.model_loader as model_loader

    monkeypatch.setattr(model_loader, "load_model", lambda: True)
    monkeypatch.setattr(model_loader, "load_phase1_model", lambda: True)
    monkeypatch.setattr(model_loader, "is_model_loaded", lambda: True)
    monkeypatch.setattr(database, "connect_to_mongo", lambda: None)
    monkeypatch.setattr(database, "close_mongo", lambda: None)
    monkeypatch.setattr(database, "is_connected", lambda: False)
    monkeypatch.setattr(
        database,
        "save_scan",
        lambda **kwargs: "scan-test-001",
    )

    fake_pred = {
        "is_scam": True,
        "confidence": 88,
        "label": "SCAM DETECTED",
        "tactics": [
            {
                "name": "Urgency Pressure",
                "key": "urgency",
                "score": 0.88,
                "description": "Creates artificial time pressure",
            }
        ],
        "word_importance": [{"word": "today", "score": 1.0}],
        "warning": "Legitimate employers never impose same-day deadlines.",
        "what_gave_it_away": "The words today triggered Urgency Pressure.",
    }

    import app.main as main

    monkeypatch.setattr(main, "predict", lambda text: fake_pred)
    monkeypatch.setattr(main, "is_model_loaded", lambda: True)
    monkeypatch.setattr(main, "save_scan", lambda **kwargs: "scan-test-001")
    monkeypatch.setattr(main, "is_connected", lambda: False)

    with TestClient(main.app) as test_client:
        yield test_client


def test_health_ok(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True


def test_classify_success(client: TestClient, samples: dict):
    text = samples["scam_samples"][0]["text"]
    res = client.post(
        "/classify",
        json={"text": text, "user_id": "panel-demo-user"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_scam"] is True
    assert body["label"] == "SCAM DETECTED"
    assert body["confidence"] == 88
    assert body["scan_id"] == "scan-test-001"
    assert body["original_text"] == text
    assert body["source"] == "text"
    assert isinstance(body["tactics"], list)
    assert body["tactics"][0]["key"] == "urgency"


def test_classify_rejects_empty_text(client: TestClient):
    res = client.post(
        "/classify",
        json={"text": "   ", "user_id": "panel-demo-user"},
    )
    assert res.status_code == 422


def test_classify_rejects_missing_user_id(client: TestClient):
    res = client.post(
        "/classify",
        json={"text": "Are you free for an interview tomorrow?"},
    )
    assert res.status_code == 422
