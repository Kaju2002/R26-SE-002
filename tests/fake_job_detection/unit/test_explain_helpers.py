"""Unit tests for explain helpers (no model weights)."""

from tests.service_imports import import_module

explain = import_module("fake-job-detection", "explain")
STOPWORDS = explain.STOPWORDS
TOKEN_RE = explain.TOKEN_RE
_to_highlights = explain._to_highlights


def test_to_highlights_sorts_by_abs_weight():
    pairs = [("pay", 0.2), ("fee", -0.5), ("remote", 0.1)]
    out = _to_highlights(pairs)
    assert out[0]["token"] == "fee"
    assert out[0]["toward"] == "legitimate"
    assert out[1]["toward"] == "fake"


def test_to_highlights_skips_empty_and_nan():
    import math

    out = _to_highlights([("", 1.0), ("ok", math.nan), ("good", 0.3)])
    assert len(out) == 1
    assert out[0]["token"] == "good"


def test_token_regex_finds_words():
    text = "Pay $99 fee today for registration"
    tokens = TOKEN_RE.findall(text)
    assert "Pay" in tokens or "fee" in tokens
    assert any("$99" == t or "99" in t for t in tokens) or "registration" in tokens


def test_stopwords_include_common_job_words():
    assert "the" in STOPWORDS
    assert "job" in STOPWORDS
    assert "work" in STOPWORDS
