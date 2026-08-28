"""Unit tests for website content risk flags in main.py."""

import main as ev_main


def test_derive_content_flags_scammy(samples: dict):
    text = samples["content_samples"]["scammy_text"]
    flags = ev_main._derive_content_flags(text)
    assert flags["scam_score"] >= 2
    assert flags["has_payment_risk"] == 1
    assert flags["has_urgency_language"] == 1


def test_derive_content_flags_clean(samples: dict):
    text = samples["content_samples"]["clean_text"]
    flags = ev_main._derive_content_flags(text)
    assert flags["scam_score"] == 0
    assert flags["has_payment_risk"] == 0
    assert flags["has_urgency_language"] == 0
