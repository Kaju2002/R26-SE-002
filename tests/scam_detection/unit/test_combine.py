"""
Unit tests for combine() decision rules — no model weights needed.
"""

from __future__ import annotations

import numpy as np

from tests.service_imports import import_module

predictor = import_module("scam-detection", "app.predictor")
combine = predictor.combine


def _p2(*, tactics=None, tactic_probs=None, words=None) -> dict:
    return {
        "tactics_detected": tactics or [],
        "tactic_probs": np.array(tactic_probs if tactic_probs is not None else [0.1, 0.1, 0.1, 0.1]),
        "word_importance": words or [{"word": "offer", "score": 1.0}],
        "input_ids": None,
    }


def test_combine_rule1_tactics_means_scam():
    p2 = _p2(
        tactics=[
            {
                "name": "Urgency Pressure",
                "key": "urgency",
                "score": 0.91,
                "description": "time pressure",
            }
        ]
    )
    result = combine(0.2, p2)
    assert result["is_scam"] is True
    assert result["inconclusive"] is False
    assert result["label"] == "SCAM DETECTED"
    assert result["decision_stage"] == "phase2_tactic"
    assert result["confidence"] == 91
    assert len(result["tactics"]) == 1
    assert result["tactics"][0]["key"] == "urgency"


def test_combine_rule2_confident_legit():
    p2 = _p2(tactic_probs=[0.05, 0.05, 0.05, 0.05])
    result = combine(0.20, p2)  # below P1_CONFIDENT_LEGIT (0.40)
    assert result["is_scam"] is False
    assert result["inconclusive"] is False
    assert result["label"] == "LEGITIMATE"
    assert result["decision_stage"] == "ensemble_legit"
    assert result["tactics"] == []


def test_combine_rule3_no_phase1_still_legit():
    p2 = _p2(tactic_probs=[0.2, 0.1, 0.1, 0.1])
    result = combine(None, p2)
    assert result["is_scam"] is False
    assert result["inconclusive"] is False
    assert result["label"] == "LEGITIMATE"
    assert result["decision_stage"] == "phase2_no_tactics"
    assert result["phase1_prob"] is None


def test_combine_phase1_high_no_tactics_means_scam():
    p2 = _p2(tactic_probs=[0.15, 0.15, 0.15, 0.15])
    result = combine(0.85, p2)  # Phase 1 high, Phase 2 no tactics
    assert result["is_scam"] is True
    assert result["inconclusive"] is False
    assert result["label"] == "SCAM DETECTED"
    assert result["decision_stage"] == "phase1_high"
    assert result["tactics"] == []
    assert "fraud patterns" in result["warning"].lower()


def test_combine_phase1_mid_band_is_suspicious():
    p2 = _p2(tactic_probs=[0.15, 0.15, 0.15, 0.15])
    result = combine(0.55, p2)
    assert result["is_scam"] is False
    assert result["inconclusive"] is True
    assert result["label"] == "SUSPICIOUS"
    assert result["decision_stage"] == "phase1_uncertain"
    assert result["tactics"] == []


def test_combine_lone_fomo_suppressed_when_phase1_confident_legit():
    p2 = _p2(
        tactics=[
            {
                "name": "FOMO",
                "key": "fomo",
                "score": 0.73,
                "description": "other candidates",
            }
        ]
    )
    result = combine(0.05, p2)  # HR-style update: low P1, lone FOMO
    assert result["is_scam"] is False
    assert result["inconclusive"] is False
    assert result["label"] == "LEGITIMATE"
    assert result["decision_stage"] == "ensemble_legit"


def test_combine_response_shape():
    p2 = _p2(
        tactics=[
            {
                "name": "FOMO",
                "key": "fomo",
                "score": 0.55,
                "description": "other candidates",
            }
        ]
    )
    result = combine(0.5, p2)
    for key in (
        "is_scam",
        "inconclusive",
        "confidence",
        "label",
        "tactics",
        "word_importance",
        "warning",
        "what_gave_it_away",
        "decision_stage",
        "phase1_prob",
    ):
        assert key in result
    assert isinstance(result["confidence"], int)
    assert 0 <= result["confidence"] <= 100
