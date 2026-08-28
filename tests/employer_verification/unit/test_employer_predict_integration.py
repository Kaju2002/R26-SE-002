"""
Optional integration — real ML model + scoring.
Skipped when final_realistic_model.pkl is not on disk.
"""

from __future__ import annotations

from pathlib import Path

import pytest

SERVICE_ROOT = Path(__file__).resolve().parents[3] / "services" / "employer-verification"
MODEL_PATH = SERVICE_ROOT / "models" / "final_realistic_model.pkl"


@pytest.fixture(scope="module")
def model_ready() -> bool:
    return MODEL_PATH.is_file()


def test_calculate_final_score_with_real_bundle(model_ready: bool, samples: dict):
    if not model_ready:
        pytest.skip("final_realistic_model.pkl not available")

    import joblib

    from tests.service_imports import import_module

    scoring_layer = import_module(
        "employer-verification",
        "app.employer_verification_model.scoring_layer",
    )
    calculate_final_score = scoring_layer.calculate_final_score

    bundle = joblib.load(MODEL_PATH)
    features = {col: 0 for col in bundle["features"]}
    features["has_https"] = 1
    features["has_about"] = 1

    case = samples["scoring_cases"][0]
    result = calculate_final_score(
        ml_probability=0.85,
        company_name=case["company_name"],
        website=case["website"],
        features=features,
        reg=case["reg"],
        rep=case["rep"],
    )
    assert result["legitimacy_score"] >= 0
    assert result["risk_level"] in ("Low", "Medium", "High")
