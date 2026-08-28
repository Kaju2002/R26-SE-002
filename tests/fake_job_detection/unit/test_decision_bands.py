"""Unit tests for fake / suspicious / legitimate decision bands (no model weights)."""

from tests.service_imports import import_module

fake_main = import_module("fake-job-detection", "main")
decide_from_probabilities = fake_main.decide_from_probabilities


def test_fake_when_above_threshold():
    result = decide_from_probabilities(0.92, 0.08)
    assert result["prediction"] == "fake"
    assert result["fake_probability"] == 0.92
    assert "FAKE" in result["message"]


def test_suspicious_mid_band():
    result = decide_from_probabilities(0.60, 0.40)
    assert result["prediction"] == "suspicious"
    assert result["confidence"] == 0.6
    assert "SUSPICIOUS" in result["message"]


def test_legitimate_low_fake_prob():
    result = decide_from_probabilities(0.20, 0.80)
    assert result["prediction"] == "legitimate"
    assert result["legitimate_probability"] == 0.8
    assert result["confidence"] == 0.8
    assert "LEGITIMATE" in result["message"]


def test_threshold_boundary_fake():
    result = decide_from_probabilities(0.85, 0.15)
    assert result["prediction"] == "fake"


def test_threshold_just_below_is_suspicious():
    result = decide_from_probabilities(0.8499, 0.1501)
    assert result["prediction"] == "suspicious"


def test_response_keys():
    result = decide_from_probabilities(0.1, 0.9)
    for key in (
        "prediction",
        "confidence",
        "legitimate_probability",
        "fake_probability",
        "message",
    ):
        assert key in result
