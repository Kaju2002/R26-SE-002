"""
Pytest setup for employer-verification tests.
Patches joblib.load so `import main` works without the real .pkl artifact.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import joblib
import numpy as np
import pytest

EV_TESTS = Path(__file__).resolve().parents[0]
TESTS_DIR = EV_TESTS.parent
REPO_ROOT = TESTS_DIR.parent
SERVICE_ROOT = REPO_ROOT / "services" / "employer-verification"
FIXTURES = EV_TESTS / "fixtures" / "samples.json"
MODEL_PATH = SERVICE_ROOT / "models" / "final_realistic_model.pkl"

FAKE_FEATURE_COLS = [
    "has_https",
    "has_about",
    "has_contact",
    "has_privacy_policy",
    "has_terms",
    "has_payment_risk",
    "has_urgency_language",
    "scam_score",
    "content_length",
    "has_glassdoor",
    "has_indeed",
    "has_linkedin",
    "has_topjobs_lk",
    "has_ft_lk",
    "has_trustpilot",
    "has_ikman_lk",
    "is_registered",
    "has_positive_reviews",
    "has_negative_reviews",
    "has_scam_report",
    "trust_score",
    "suspicion_score",
    "website_alive",
    "valid_website",
    "is_http_only",
    "has_suspicious_tld",
    "email_type_encoded",
    "social_only_presence",
    "scrape_failed",
    "content_score",
]


def _fake_model_bundle():
    model = MagicMock()
    model.predict.return_value = np.array([1])
    model.predict_proba.return_value = np.array([[0.18, 0.82]])
    return {"model": model, "features": FAKE_FEATURE_COLS}


if not getattr(joblib, "_ev_test_patched", False):
    _ORIGINAL_JOBLIB_LOAD = joblib.load

    def _patched_joblib_load(path):
        path_str = str(path).replace("\\", "/")
        if path_str.endswith("final_realistic_model.pkl"):
            real = Path(path)
            if real.is_file():
                return _ORIGINAL_JOBLIB_LOAD(path)
            return _fake_model_bundle()
        return _ORIGINAL_JOBLIB_LOAD(path)

    joblib.load = _patched_joblib_load  # type: ignore[assignment]
    joblib._ev_test_patched = True  # type: ignore[attr-defined]


@pytest.fixture(scope="session")
def samples() -> dict:
    with FIXTURES.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def feature_cols() -> list[str]:
    return list(FAKE_FEATURE_COLS)
