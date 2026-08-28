"""Unit tests for calculate_final_score (no network — reg/rep passed in)."""

from tests.service_imports import import_module

scoring_layer = import_module(
    "employer-verification",
    "app.employer_verification_model.scoring_layer",
)
calculate_final_score = scoring_layer.calculate_final_score


def test_strong_legit_case_scores_well(samples: dict):
    case = next(c for c in samples["scoring_cases"] if c["id"] == "strong_legit")
    result = calculate_final_score(
        ml_probability=case["ml_probability"],
        company_name=case["company_name"],
        website=case["website"],
        features=case["features"],
        reg=case["reg"],
        rep=case["rep"],
    )
    assert result["legitimacy_score"] >= 60
    assert result["risk_level"] in case["expect_risk_in"]
    assert "score_breakdown" in result
    assert result["score_breakdown"]["ml_score"] > 0


def test_high_fraud_case_is_high_risk(samples: dict):
    case = next(c for c in samples["scoring_cases"] if c["id"] == "high_fraud")
    result = calculate_final_score(
        ml_probability=case["ml_probability"],
        company_name=case["company_name"],
        website=case["website"],
        features=case["features"],
        reg=case["reg"],
        rep=case["rep"],
    )
    assert result["risk_level"] in case["expect_risk_in"]
    assert result["legitimacy_score"] < 45
    assert result["color"] == "red"
    assert any("Scam" in s for s in result["evidence"]["reputation"])


def test_registered_evidence_listed(samples: dict):
    case = next(c for c in samples["scoring_cases"] if c["id"] == "strong_legit")
    result = calculate_final_score(
        ml_probability=case["ml_probability"],
        company_name=case["company_name"],
        website=case["website"],
        features=case["features"],
        reg=case["reg"],
        rep=case["rep"],
    )
    reg_text = " ".join(result["evidence"]["registration"])
    assert "CSE" in reg_text or "Registered" in reg_text or result["evidence"]["registration_status"] == "registered"


def test_response_shape():
    result = calculate_final_score(
        ml_probability=0.7,
        company_name="Test Co Pvt Ltd",
        website="https://example.lk",
        features={"has_https": 1},
        reg={"government_registration_status": "not_found"},
        rep={},
    )
    for key in (
        "verdict",
        "risk_level",
        "legitimacy_score",
        "color",
        "evidence",
        "recommendation",
        "score_breakdown",
    ):
        assert key in result
