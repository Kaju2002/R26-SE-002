"""Map live job / ML outputs to risk_aggregation indicator labels."""

from __future__ import annotations

from typing import Any

FAKE_JOB_LABELS = {
    "legitimate": "Not Fake",
    "not fake": "Not Fake",
    "suspicious": "Suspicious",
    "fake": "Fake",
    "error": "Suspicious",
    "skipped": "Not Fake",
}


def map_fake_job(prediction: str | None) -> str:
    key = str(prediction or "legitimate").strip().lower()
    return FAKE_JOB_LABELS.get(key, "Not Fake")


def map_employer(is_verified: bool) -> str:
    return "Legitimate Company" if is_verified else "Fake Company"


def map_comm_scam(is_scam: bool | None) -> str:
    return "Scam" if is_scam else "Not Scam"


def _job_verified(raw: dict[str, Any]) -> bool:
    if "is_verified" in raw:
        return bool(raw.get("is_verified"))
    return bool(raw.get("isVerified"))


def _job_risk_prediction(raw: dict[str, Any]) -> str | None:
    for key in ("risk_prediction", "riskPrediction"):
        value = raw.get(key)
        if value:
            return str(value)

    risk_check = raw.get("riskCheck") or raw.get("risk_check")
    if isinstance(risk_check, dict):
        prediction = risk_check.get("prediction")
        if prediction:
            return str(prediction)

    return None


def _job_comm_is_scam(raw: dict[str, Any]) -> bool | None:
    for key in ("comm_is_scam", "commIsScam"):
        if key in raw and raw.get(key) is not None:
            return bool(raw.get(key))
    return None


def job_to_indicator_row(raw: dict[str, Any]) -> dict[str, str]:
    job_id = str(raw.get("job_id") or raw.get("id") or "").strip()
    return {
        "job_id": job_id,
        "fake_job_indicator": map_fake_job(_job_risk_prediction(raw)),
        "employer_indicator": map_employer(_job_verified(raw)),
        "comm_scam_indicator": map_comm_scam(_job_comm_is_scam(raw)),
    }
