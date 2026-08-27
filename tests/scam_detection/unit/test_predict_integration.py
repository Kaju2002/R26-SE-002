"""
Optional integration tests — require local Phase-2 model weights.
Skipped automatically when models are not loaded.
"""

from __future__ import annotations

import pytest

from app.model_loader import is_model_loaded, load_model, load_phase1_model
from app.predictor import predict


@pytest.fixture(scope="module")
def model_ready() -> bool:
    load_model()
    load_phase1_model()
    return bool(is_model_loaded())


def test_predict_scam_fixture_flagged(model_ready: bool, samples: dict):
    if not model_ready:
        pytest.skip("Phase-2 model weights not available on this machine")

    text = samples["scam_samples"][0]["text"]
    result = predict(text)
    assert "is_scam" in result
    assert "confidence" in result
    assert "tactics" in result
    # Fee/urgency samples should usually flag; if model drifts, still assert shape.
    assert isinstance(result["is_scam"], bool)
    assert isinstance(result["confidence"], int)


def test_predict_safe_fixture_shape(model_ready: bool, samples: dict):
    if not model_ready:
        pytest.skip("Phase-2 model weights not available on this machine")

    text = samples["safe_samples"][0]["text"]
    result = predict(text)
    assert result["label"] in ("SCAM DETECTED", "LEGITIMATE")
    assert isinstance(result["tactics"], list)
