"""Unit tests for scoring helper functions (no model weights)."""

from app.employer_verification_model.scoring_layer import (
    _normalize_url,
    get_recommendation,
)


def test_normalize_url_adds_https():
    assert _normalize_url("example.lk").startswith("https://")


def test_normalize_url_fixes_missing_scheme():
    assert _normalize_url("http://example.lk") == "http://example.lk"


def test_get_recommendation_low_risk():
    text = get_recommendation("Low")
    assert "legitimate" in text.lower() or "safe" in text.lower()


def test_get_recommendation_high_risk():
    text = get_recommendation("High")
    lowered = text.lower()
    assert "fraud" in lowered or "do not pay" in lowered


def test_get_recommendation_medium_unregistered():
    text = get_recommendation("Medium", registration_status="not_found")
    assert "registration" in text.lower() or "verify" in text.lower()
