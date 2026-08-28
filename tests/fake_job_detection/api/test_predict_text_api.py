"""
API smoke tests for fake-job-detection with mocked model inference.
No model weights required.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    import main as fake_main

    async def _noop_lifespan(app):
        fake_main.state["tokenizer"] = object()
        fake_main.state["model"] = object()
        yield
        fake_main.state.clear()

    monkeypatch.setattr(fake_main, "lifespan", _noop_lifespan)

    def fake_inference(text: str) -> dict:
        return {
            "prediction": "fake",
            "confidence": 0.91,
            "legitimate_probability": 0.09,
            "fake_probability": 0.91,
            "message": "This job post has been detected as FAKE with 91% confidence",
        }

    monkeypatch.setattr(fake_main, "_run_text_inference", fake_inference)

    # Rebuild app with patched lifespan
    from contextlib import asynccontextmanager
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    @asynccontextmanager
    async def patched_lifespan(app: FastAPI):
        fake_main.state["tokenizer"] = object()
        fake_main.state["model"] = object()
        yield
        fake_main.state.clear()

    test_app = FastAPI(title="Fake Job Detector Test", lifespan=patched_lifespan)
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    test_app.add_api_route("/health", fake_main.health, methods=["GET"])
    test_app.add_api_route("/predict-text", fake_main.predict_text, methods=["POST"])

    with TestClient(test_app) as test_client:
        yield test_client


def test_health_ok(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "Fake Job" in body["model"]


def test_predict_text_success(client: TestClient, samples: dict):
    text = samples["fake_samples"][0]["text"]
    res = client.post("/predict-text", json={"text": text})
    assert res.status_code == 200
    body = res.json()
    assert body["prediction"] == "fake"
    assert body["fake_probability"] == 0.91
    assert body["extracted_text"] == text[:2000]
    assert body["lime"] == []
    assert body["shap"] == []


def test_predict_text_rejects_short_text(client: TestClient):
    res = client.post("/predict-text", json={"text": "too short"})
    assert res.status_code == 400
    assert "15 characters" in res.json()["detail"]


def test_predict_text_rejects_empty(client: TestClient):
    res = client.post("/predict-text", json={"text": "   "})
    assert res.status_code == 400
