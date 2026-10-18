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
NOT_A_MESSAGE = (
    "This does not look like a recruiter message. "
    "Please paste the chat, or send a clear screenshot of it."
)

_RISK = {"SCAM DETECTED": "high", "SUSPICIOUS": "medium", "LEGITIMATE": "low"}


_TACTIC_SENTENCE = {
    "urgency": "They tried to rush you into deciding",
    "urgency pressure": "They tried to rush you into deciding",
    "fomo": "They said the chance would go to someone else if you waited",
    "sunk_cost": "They used time or money you already spent to pressure you",
    "sunk cost": "They used time or money you already spent to pressure you",
    "sunk-cost manipulation": "They used time or money you already spent to pressure you",
    "social_proof": "They used fake praise or authority to look genuine",
    "social proof manipulation": "They used fake praise or authority to look genuine",
}


def _line(value: Any) -> str:
    return " ".join(str(value or "").split()).strip(" .")


def _note(found: list, watch: list, action: str) -> list:
    reasons = []
    if found:
        reasons.append("What we found: " + ". ".join(found) + ".")
    if watch:
        reasons.append("Watch-outs: " + ". ".join(watch) + ".")
    if action:
        reasons.append("What to do: " + action)
    return reasons


def _tactic_sentence(tactic: Dict[str, Any]) -> str:
    key = str(tactic.get("key") or "").strip().lower().replace("-", " ").replace("_", " ")
    name = str(tactic.get("name") or "").strip().lower()
    for label in (str(tactic.get("key") or "").strip().lower(), key, name):
        if label in _TACTIC_SENTENCE:
            return _TACTIC_SENTENCE[label]
    if tactic.get("name"):
        return f"The messages use this pressure: {tactic['name']}"
    return ""


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

    watch = []
    if risk == "high":
        found = ["These messages use pressure that real recruiters usually do not"]
        watch = [_tactic_sentence(t) for t in tactics]
        if _line(data.get("warning")):
            watch.append(_line(data.get("warning")))
        action = "Do not pay a fee or share an OTP, your bank details, or your NIC."
    elif risk == "medium":
        found = ["These messages have some scam-like signs, but not enough to call them a scam"]
        if _line(data.get("warning")):
            watch.append(_line(data.get("warning")))
        action = "Do not pay a fee or share an OTP until you have confirmed the employer."
    else:
        found = ["No fee request, OTP request, or pressure tactic was found in these messages"]
        action = "Still do not pay a fee or share an OTP to get a job."
    reasons = _note(found, [part for part in watch if part][:4], action)
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
        return failed(SOURCE, NOT_A_MESSAGE if e.status == 400 else e.message)
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
            return failed(SOURCE, NOT_A_MESSAGE)
        return failed(SOURCE, e.message)
    return _to_result(data, "image")
