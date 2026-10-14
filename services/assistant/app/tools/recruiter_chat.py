# app/tools/recruiter_chat.py
# Recruiter messages check: adapter over scam-detection / BSTD (POST /classify, POST /classify-image).
# The user's login token is forwarded, so scans are linked to the user and rate-limited per user.

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
)

SOURCE = "recruiter_chat"
LABEL = "message check"
MAX_TEXT_CHARS = 2000  # scam-detection rejects longer text

_RISK = {"SCAM DETECTED": "high", "SUSPICIOUS": "medium", "LEGITIMATE": "low"}


def _auth_headers(auth_token: Optional[str]) -> Dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"} if auth_token else {}


def _to_result(data: Dict[str, Any], input_kind: str, truncated: bool = False) -> CheckResult:
    label = str(data.get("label") or "").upper()
    tactics = [
        {"key": t.get("key"), "name": t.get("name"), "score": t.get("score")}
        for t in data.get("tactics") or []
        if isinstance(t, dict)
    ]
    details: Dict[str, Any] = {
        "input": input_kind,
        "label": label,
        "confidence": data.get("confidence"),
        "tactics": tactics,
        "warning": data.get("warning"),
        "what_gave_it_away": data.get("what_gave_it_away"),
        "scan_id": data.get("scan_id"),
        "truncated": truncated,
    }
    if input_kind == "image":
        details["extracted_text"] = data.get("extracted_text") or ""

    risk = _RISK.get(label)
    if risk is None:
        return failed(SOURCE, f"The {LABEL} returned an answer we could not read.", **details)

    if risk == "high":
        names = [t["name"] for t in tactics if t.get("name")]
        reasons = [f"Manipulation tactics found: {', '.join(names)}."] if names else []
        reasons += [r for r in (data.get("warning"), data.get("what_gave_it_away")) if r]
    elif risk == "medium":
        reasons = [data.get("warning") or "These messages have some scam-like signals."]
    else:
        reasons = ["No manipulation tactics or scam patterns were found in these messages."]
    if truncated:
        reasons.append(f"Only the last {MAX_TEXT_CHARS:,} characters were checked.")

    return done(SOURCE, risk, reasons, details)


async def check_recruiter_text(
    text: str,
    *,
    auth_token: Optional[str],
    client: Optional[httpx.AsyncClient] = None,
) -> CheckResult:
    text = (text or "").strip()
    if not text:
        return failed(SOURCE, "Please paste the recruiter's messages.")
    # The latest messages usually hold the request (fee, documents, OTP), so keep the end.
    truncated = len(text) > MAX_TEXT_CHARS
    if truncated:
        text = text[-MAX_TEXT_CHARS:]

    s = get_settings()
    try:
        data = await call_service(
            "POST",
            f"{s.scam_detection_url}/classify",
            label=LABEL,
            timeout=s.recruiter_check_timeout_seconds,
            client=client,
            json={"text": text},
            headers=_auth_headers(auth_token),
        )
    except ServiceError as e:
        return failed(SOURCE, e.message)
    return _to_result(data, "text", truncated)


async def check_recruiter_image(
    image: bytes,
    *,
    auth_token: Optional[str],
    filename: str = "chat_screenshot",
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
            f"{s.scam_detection_url}/classify-image",
            label=LABEL,
            timeout=s.recruiter_check_timeout_seconds,
            client=client,
            files={"file": (f"{filename}.{kind}", image, IMAGE_MIME_TYPES[kind])},
            headers=_auth_headers(auth_token),
        )
    except ServiceError as e:
        if e.status == 400:
            return failed(SOURCE, "No readable text was found in the screenshot. Please paste the messages instead.")
        return failed(SOURCE, e.message)
    return _to_result(data, "image")
