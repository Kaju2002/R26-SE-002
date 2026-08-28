"""Unit tests for tactic thresholds and metadata (no model weights needed)."""

from tests.service_imports import import_module

predictor = import_module("scam-detection", "app.predictor")
TACTIC_META = predictor.TACTIC_META
TACTIC_THRESHOLDS = predictor.TACTIC_THRESHOLDS
P1_CONFIDENT_LEGIT = predictor.P1_CONFIDENT_LEGIT
P1_UNCERTAIN = predictor.P1_UNCERTAIN


def test_all_tactics_have_metadata():
    for key in TACTIC_THRESHOLDS:
        assert key in TACTIC_META
        meta = TACTIC_META[key]
        assert meta["name"]
        assert meta["description"]
        assert meta["warning"]


def test_thresholds_are_probabilities():
    for key, value in TACTIC_THRESHOLDS.items():
        assert 0.0 < value <= 1.0, f"{key} threshold out of range: {value}"


def test_phase1_band_ordering():
    assert 0.0 < P1_CONFIDENT_LEGIT < P1_UNCERTAIN <= 1.0
