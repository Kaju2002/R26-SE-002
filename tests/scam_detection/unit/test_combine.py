"""
Unit tests for combine() decision rules — no model weights needed.
"""

from __future__ import annotations

import numpy as np

from app.predictor import combine


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
    assert result["label"] == "SCAM DETECTED"
    assert result["decision_stage"] == "phase2_tactic"
    assert result["confidence"] == 91
    assert len(result["tactics"]) == 1
    assert result["tactics"][0]["key"] == "urgency"


def test_combine_rule2_confident_legit():
    p2 = _p2(tactic_probs=[0.05, 0.05, 0.05, 0.05])
    result = combine(0.20, p2)  # below P1_CONFIDENT_LEGIT (0.40)
    assert result["is_scam"] is False
    assert result["label"] == "LEGITIMATE"
    assert result["decision_stage"] == "ensemble_legit"
    assert result["tactics"] == []


def test_combine_rule3_no_phase1_still_legit():
    p2 = _p2(tactic_probs=[0.2, 0.1, 0.1, 0.1])
    result = combine(None, p2)
    assert result["is_scam"] is False
    assert result["label"] == "LEGITIMATE"
    assert result["decision_stage"] == "phase2_no_tactics"
    assert result["phase1_prob"] is None


def test_combine_uncertain_phase1_trusts_phase2_legit():
    p2 = _p2(tactic_probs=[0.15, 0.15, 0.15, 0.15])
    result = combine(0.70, p2)  # Phase 1 leans scam, Phase 2 no tactics
    assert result["is_scam"] is False
    assert result["label"] == "LEGITIMATE"
    assert result["decision_stage"] == "phase2_no_tactics"


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
