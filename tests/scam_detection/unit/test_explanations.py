"""Unit tests for explanation / warning helpers (no model weights needed)."""

from tests.service_imports import import_module

predictor = import_module("scam-detection", "app.predictor")
build_explanation = predictor.build_explanation
build_warning = predictor.build_warning


def test_build_explanation_no_tactics():
    text = build_explanation([], [{"word": "hello", "score": 1.0}])
    assert "No manipulation tactics" in text


def test_build_explanation_with_tactics():
    text = build_explanation(
        ["urgency", "fomo"],
        [{"word": "today", "score": 1.0}, {"word": "pay", "score": 0.8}],
    )
    assert "today" in text or "pay" in text
    assert "Urgency" in text or "FOMO" in text


def test_build_warning_no_tactics():
    text = build_warning([])
    assert "appears safe" in text.lower() or "no manipulation" in text.lower()


def test_build_warning_with_tactics():
    text = build_warning(["urgency"])
    assert "Legitimate employers" in text or "deadline" in text.lower()
