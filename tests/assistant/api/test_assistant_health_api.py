"""
API tests for the assistant /health route. Dependent services are mocked; nothing needs to run.
"""

from __future__ import annotations

import asyncio

import httpx
import pytest


def _get(app, path: str) -> httpx.Response:
    # httpx's ASGI transport instead of TestClient: works with old and new Starlette versions.
    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(run())


@pytest.fixture
def assistant(monkeypatch):
    from tests.service_imports import import_module

    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    config = import_module("assistant", "app.config")
    config.get_settings.cache_clear()
    main = import_module("assistant", "app.main")
    yield main
    config.get_settings.cache_clear()


def _fake_probe(statuses: dict):
    async def probe(_client, url):
        for fragment, status in statuses.items():
            if fragment in url:
                return status
        return "down"

    return probe


def test_health_ok_when_all_services_up(assistant, monkeypatch):
    monkeypatch.setattr(assistant, "_probe", _fake_probe({":8000": "up", ":8001": "up", ":8003": "up"}))
    res = _get(assistant.app, "/health")

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["services"] == {
        "scam_detection": "up",
        "employer_verification": "up",
        "fake_job_detection": "up",
    }
    assert body["llm"] == {"provider": "gemini", "configured": True, "model": "gemini-2.5-flash"}


def test_health_degraded_when_a_service_is_down(assistant, monkeypatch):
    monkeypatch.setattr(assistant, "_probe", _fake_probe({":8000": "up", ":8001": "down", ":8003": "up"}))
    body = _get(assistant.app, "/health").json()

    assert body["status"] == "degraded"
    assert body["services"]["employer_verification"] == "down"


def test_health_never_returns_the_api_key(assistant, monkeypatch):
    monkeypatch.setattr(assistant, "_probe", _fake_probe({}))
    res = _get(assistant.app, "/health")

    assert "test-key" not in res.text


def test_llm_not_configured_without_key(monkeypatch):
    from tests.service_imports import import_module

    monkeypatch.setenv("GEMINI_API_KEY", "")
    config = import_module("assistant", "app.config")
    config.get_settings.cache_clear()
    try:
        assert config.get_settings().llm_configured is False
    finally:
        config.get_settings.cache_clear()


def test_unreachable_service_is_reported_down(assistant, monkeypatch):
    monkeypatch.setenv("SCAM_DETECTION_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("EMPLOYER_VERIFICATION_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("FAKE_JOB_DETECTION_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("HEALTH_TIMEOUT_SECONDS", "1")
    assistant.get_settings.cache_clear()

    body = _get(assistant.app, "/health").json()

    assert body["status"] == "degraded"
    assert set(body["services"].values()) == {"down"}
