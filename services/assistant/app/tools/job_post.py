# app/tools/job_post.py
# Job post check: adapter over fake-job-detection (POST /predict-text, POST /predict).

from typing import Any, Dict, Optional

import httpx

from app.config import get_settings
from app.schemas import CheckResult
from app.tools.common import (
    IMAGE_MIME_TYPES,
    ServiceError,
    call_service,
    detect_image_type,
    done,
    failed,
    image_problem,
    percent,
)

SOURCE = "job_post"
LABEL = "job post check"
MIN_TEXT_CHARS = 15  # fake-job-detection rejects shorter text
MAX_TEXT_CHARS = 5000

_RISK = {"fake": "high", "suspicious": "medium", "legitimate": "low"}


def _to_result(data: Dict[str, Any], input_kind: str) -> CheckResult:
    prediction = str(data.get("prediction") or "").lower()
    details: Dict[str, Any] = {
        "input": input_kind,
        "prediction": prediction,
        "fake_probability": data.get("fake_probability"),
        "legitimate_probability": data.get("legitimate_probability"),
        "fake_signals": list(data.get("fake_signals_found") or []),
        "legit_signals": list(data.get("legit_signals_found") or []),
        "advice": list(data.get("advice") or []),
    }
    if input_kind == "image":
        details["extracted_text"] = data.get("extracted_text") or ""

    if prediction == "skipped":
        return failed(
            SOURCE,
            "The image had too little text to check. Please paste the job post text instead.",
            **details,
        )

    risk = _RISK.get(prediction)
    if risk is None:
        return failed(SOURCE, f"The {LABEL} returned an answer we could not read.", **details)

    fake_pct = percent(data.get("fake_probability"))
    legit_pct = percent(data.get("legitimate_probability"))
    if risk == "high":
        reasons = [f"The job post model rated this post as likely fake ({fake_pct}% fake probability)."]
    elif risk == "medium":
        reasons = [f"The job post model found some suspicious patterns ({fake_pct}% fake probability)."]
    else:
        reasons = [f"The job post model found no strong signs of a fake job ({legit_pct}% legitimate probability)."]
    reasons += [f"Warning sign in the post: {signal}." for signal in details["fake_signals"]]

    return done(SOURCE, risk, reasons, details)


async def check_job_post_text(text: str, *, client: Optional[httpx.AsyncClient] = None) -> CheckResult:
    text = (text or "").strip()
    if len(text) < MIN_TEXT_CHARS:
        return failed(SOURCE, f"The job post text is too short to check (at least {MIN_TEXT_CHARS} characters).")

    s = get_settings()
    try:
        data = await call_service(
            "POST",
            f"{s.fake_job_detection_url}/predict-text",
            label=LABEL,
            timeout=s.job_post_timeout_seconds,
            client=client,
            json={"text": text[:MAX_TEXT_CHARS]},
        )
    except ServiceError as e:
        return failed(SOURCE, e.message)
    return _to_result(data, "text")


async def check_job_post_image(
    image: bytes,
    *,
    filename: str = "job_post",
    client: Optional[httpx.AsyncClient] = None,
) -> CheckResult:
    problem = image_problem(image)
    if problem:
        return failed(SOURCE, problem)

    kind = detect_image_type(image)
    s = get_settings()
    try:
        data = await call_service(
            "POST",
            f"{s.fake_job_detection_url}/predict",
            label=LABEL,
            timeout=s.job_post_timeout_seconds,
            client=client,
            files={"image": (f"{filename}.{kind}", image, IMAGE_MIME_TYPES[kind])},
        )
    except ServiceError as e:
        return failed(SOURCE, e.message)
    return _to_result(data, "image")
