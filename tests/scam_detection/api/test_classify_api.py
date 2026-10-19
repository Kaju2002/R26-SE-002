"""
API tests for scam-detection with mocked model + DB.
No model weights required.
"""

from __future__ import annotations

import io
import sys
import time

import jwt
import pytest
from fastapi.testclient import TestClient
from PIL import Image

TEST_SECRET = "test-jwt-secret-that-is-at-least-32-bytes"
INTERNAL_KEY = "test-internal-key"

VALID_MESSAGE = (
    "Please pay the registration fee of Rs 2500 today so we can confirm your job interview on WhatsApp."
)

FAKE_PRED = {
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


def _token(user_id: str = "user-a", secret: str = TEST_SECRET, **extra) -> str:
    payload = {"userId": user_id, "email": f"{user_id}@test.dev", **extra}
    return jwt.encode(payload, secret, algorithm="HS256")


def _auth(user_id: str = "user-a") -> dict:
    return {"Authorization": f"Bearer {_token(user_id)}"}


def _png_bytes(size=(40, 20), mode="RGB") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, color=0).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture()
def api(monkeypatch: pytest.MonkeyPatch):
    from tests.service_imports import import_module

    main = import_module("scam-detection", "app.main")
    security = sys.modules["app.security"]

    monkeypatch.setenv("JWT_SECRET", TEST_SECRET)
    monkeypatch.setenv("INTERNAL_SERVICE_KEY", INTERNAL_KEY)

    for name in ("load_model", "load_phase1_model"):
        monkeypatch.setattr(main, name, lambda: True)
    monkeypatch.setattr(main, "connect_to_mongo", lambda: None)
    monkeypatch.setattr(main, "close_mongo", lambda: None)
    monkeypatch.setattr(main, "is_model_loaded", lambda: True)
    monkeypatch.setattr(main, "is_connected", lambda: True)
    monkeypatch.setattr(main, "predict", lambda text: dict(FAKE_PRED))

    saved: list[dict] = []

    def fake_save_scan(**kwargs):
        saved.append(kwargs)
        return "scan-test-001"

    monkeypatch.setattr(main, "save_scan", fake_save_scan)
    monkeypatch.setattr(
        main,
        "extract_text_from_image",
        lambda data: {"success": True, "extracted_text": VALID_MESSAGE, "error": None},
    )

    security.analysis_rate_limiter.reset()
    monkeypatch.setattr(security.analysis_rate_limiter, "limit", 20)

    with TestClient(main.app) as client:
        yield {"client": client, "main": main, "security": security, "saved": saved}


# ─── HEALTH ───────────────────────────────────────────────────────


def test_health_is_public(api):
    res = api["client"].get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["model_loaded"] is True


# ─── AUTH ON /classify ───────────────────────────────────────────


def test_classify_requires_auth(api):
    res = api["client"].post("/classify", json={"text": "Pay the fee today"})
    assert res.status_code == 401


def test_classify_rejects_token_signed_with_wrong_secret(api):
    bad = {"Authorization": f"Bearer {_token(secret='a-different-secret-also-32-bytes-long')}"}
    res = api["client"].post("/classify", json={"text": "Pay the fee today"}, headers=bad)
    assert res.status_code == 401


def test_classify_rejects_expired_token(api):
    expired = _token(exp=int(time.time()) - 60)
    res = api["client"].post(
        "/classify",
        json={"text": "Pay the fee today"},
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_classify_saves_under_token_user_not_body_user(api, samples: dict):
    text = samples["scam_samples"][0]["text"]
    res = api["client"].post(
        "/classify",
        json={"text": text, "user_id": "someone-else"},
        headers=_auth("user-a"),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_scam"] is True
    assert body["label"] == "SCAM DETECTED"
    assert body["scan_id"] == "scan-test-001"
    assert body["original_text"] == text
    assert body["source"] == "text"
    assert api["saved"][0]["user_id"] == "user-a"


def test_classify_with_internal_key_is_not_saved(api):
    res = api["client"].post(
        "/classify",
        json={"text": VALID_MESSAGE},
        headers={"X-Internal-Service-Key": INTERNAL_KEY},
    )
    assert res.status_code == 200
    assert res.json()["scan_id"] is None
    assert api["saved"] == []


def test_classify_rejects_wrong_internal_key(api):
    res = api["client"].post(
        "/classify",
        json={"text": "Pay the fee today"},
        headers={"X-Internal-Service-Key": "guess"},
    )
    assert res.status_code == 401


def test_classify_rejects_text_that_is_not_a_message(api, monkeypatch: pytest.MonkeyPatch):
    called = {"predict": False}

    def fail_if_called(text):
        called["predict"] = True
        return dict(FAKE_PRED)

    monkeypatch.setattr(api["main"], "predict", fail_if_called)
    short = api["client"].post("/classify", json={"text": "Pay the fee today"}, headers=_auth())
    unrelated = api["client"].post(
        "/classify",
        json={"text": "My cat is sleeping on the sofa near the window this afternoon."},
        headers=_auth(),
    )

    assert short.status_code == 400
    assert unrelated.status_code == 400
    assert "recruiter message" in short.json()["detail"]
    assert called["predict"] is False


def test_classify_image_without_a_message_is_rejected(api, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        api["main"],
        "extract_text_from_image",
        lambda data: {"success": True, "extracted_text": "a cat on a sofa", "error": None},
    )
    res = api["client"].post(
        "/classify-image",
        files={"file": ("shot.png", _png_bytes(), "image/png")},
        headers=_auth(),
    )
    assert res.status_code == 400
    assert "recruiter message" in res.json()["detail"]
    assert api["saved"] == []


def test_classify_rejects_empty_text(api):
    res = api["client"].post("/classify", json={"text": "   "}, headers=_auth())
    assert res.status_code == 422


def test_suspicious_label_is_returned(api, monkeypatch: pytest.MonkeyPatch):
    suspicious = {
        **FAKE_PRED,
        "is_scam": False,
        "inconclusive": True,
        "label": "SUSPICIOUS",
        "confidence": 58,
        "tactics": [],
    }
    monkeypatch.setattr(api["main"], "predict", lambda text: suspicious)
    res = api["client"].post(
        "/classify",
        json={"text": "Kindly share your NIC copy so we can process your job application and interview today."},
        headers={"X-Internal-Service-Key": INTERNAL_KEY},
    )
    assert res.status_code == 200
    assert res.json()["label"] == "SUSPICIOUS"
    assert res.json()["inconclusive"] is True


# ─── RATE LIMIT ──────────────────────────────────────────────────


def test_rate_limit_per_user(api, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(api["security"].analysis_rate_limiter, "limit", 2)
    client = api["client"]
    for _ in range(2):
        assert client.post("/classify", json={"text": VALID_MESSAGE}, headers=_auth("user-a")).status_code == 200

    blocked = client.post("/classify", json={"text": VALID_MESSAGE}, headers=_auth("user-a"))
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1

    # Another user has their own budget; service calls are not limited.
    assert client.post("/classify", json={"text": VALID_MESSAGE}, headers=_auth("user-b")).status_code == 200
    internal = {"X-Internal-Service-Key": INTERNAL_KEY}
    assert client.post("/classify", json={"text": VALID_MESSAGE}, headers=internal).status_code == 200


# ─── IMAGE UPLOADS ───────────────────────────────────────────────


def test_classify_image_accepts_png_and_saves_for_user(api):
    res = api["client"].post(
        "/classify-image",
        files={"file": ("shot.png", _png_bytes(), "image/png")},
        headers=_auth("user-a"),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "image"
    assert body["extracted_text"] == VALID_MESSAGE
    assert api["saved"][0]["user_id"] == "user-a"
    assert api["saved"][0]["source"] == "image"


def test_classify_image_from_service_is_not_saved(api):
    res = api["client"].post(
        "/classify-image",
        files={"file": ("shot.png", _png_bytes(), "image/png")},
        headers={"X-Internal-Service-Key": INTERNAL_KEY},
    )
    assert res.status_code == 200
    assert res.json()["scan_id"] is None
    assert api["saved"] == []


def test_upload_checks_content_not_declared_type(api):
    res = api["client"].post(
        "/classify-image",
        files={"file": ("shot.png", b"%PDF-1.7 not an image", "image/png")},
        headers=_auth(),
    )
    assert res.status_code == 415


def test_upload_rejects_files_over_5mb(api):
    big = b"\x89PNG\r\n\x1a\n" + b"\0" * (5 * 1024 * 1024)
    res = api["client"].post(
        "/classify-image",
        files={"file": ("big.png", big, "image/png")},
        headers=_auth(),
    )
    assert res.status_code == 413


def test_upload_rejects_too_many_pixels(api):
    huge = _png_bytes(size=(6000, 6000), mode="1")
    assert len(huge) < 5 * 1024 * 1024
    res = api["client"].post(
        "/classify-image",
        files={"file": ("huge.png", huge, "image/png")},
        headers=_auth(),
    )
    assert res.status_code == 413


def test_ocr_only_requires_auth(api):
    res = api["client"].post(
        "/ocr-only",
        files={"file": ("shot.png", _png_bytes(), "image/png")},
    )
    assert res.status_code == 401


# ─── HISTORY OWNERSHIP ───────────────────────────────────────────


def test_history_requires_user_token(api):
    assert api["client"].get("/history").status_code == 401
    internal = {"X-Internal-Service-Key": INTERNAL_KEY}
    assert api["client"].get("/history", headers=internal).status_code == 401


def test_history_uses_token_user(api, monkeypatch: pytest.MonkeyPatch):
    seen = {}

    def fake_history(user_id, limit=50):
        seen["user_id"] = user_id
        return []

    monkeypatch.setattr(api["main"], "get_scan_history", fake_history)
    res = api["client"].get("/history", headers=_auth("user-a"))
    assert res.status_code == 200
    assert res.json()["user_id"] == "user-a"
    assert seen["user_id"] == "user-a"


def test_scan_detail_of_other_user_is_not_found(api, monkeypatch: pytest.MonkeyPatch):
    owner = {"scan-1": "user-a"}

    def fake_get(scan_id, user_id):
        if owner.get(scan_id) != user_id:
            return None
        return {"scan_id": scan_id, "is_scam": True, "confidence": 90, "original_text": "x",
                "created_at": "2026-10-11T00:00:00Z"}

    monkeypatch.setattr(api["main"], "get_scan_by_id", fake_get)
    assert api["client"].get("/scan/scan-1", headers=_auth("user-a")).status_code == 200
    assert api["client"].get("/scan/scan-1", headers=_auth("user-b")).status_code == 404


def test_delete_and_clear_are_scoped_to_token_user(api, monkeypatch: pytest.MonkeyPatch):
    calls = {}
    monkeypatch.setattr(
        api["main"], "delete_scan", lambda scan_id, user_id: calls.setdefault("delete", user_id) == "user-a"
    )
    monkeypatch.setattr(
        api["main"], "delete_all_scans", lambda user_id: calls.setdefault("clear", user_id) and 3
    )

    assert api["client"].delete("/history/scan-1", headers=_auth("user-a")).status_code == 200
    res = api["client"].delete("/history", headers=_auth("user-a"))
    assert res.status_code == 200
    assert res.json()["deleted_count"] == 3
    assert calls == {"delete": "user-a", "clear": "user-a"}


# ─── CORS ────────────────────────────────────────────────────────


def test_cors_does_not_allow_unknown_origins(api):
    res = api["client"].get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in res.headers
