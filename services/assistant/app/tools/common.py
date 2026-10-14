# app/tools/common.py
# Shared helpers for the tool adapters: result builders, one safe way to call a service,
# and image checks done before anything is uploaded.

import logging
from typing import Any, Dict, List, Optional

import httpx

from app.schemas import CheckResult, CheckSource, Risk

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_MIME_TYPES = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def done(source: CheckSource, risk: Risk, reasons: List[str], details: Dict[str, Any]) -> CheckResult:
    return CheckResult(source=source, status="done", risk=risk, reasons=reasons, details=details)


def failed(source: CheckSource, reason: str, **details: Any) -> CheckResult:
    """The check could not run. The conversation continues; the verdict counts it as not checked."""
    return CheckResult(source=source, status="failed", risk="unknown", reasons=[reason], details=details)


def detect_image_type(data: bytes) -> Optional[str]:
    """'jpeg', 'png' or 'webp' from the file header (the declared type is not trusted)."""
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def image_problem(data: bytes) -> Optional[str]:
    """User-facing reason why an image cannot be checked, or None if it is fine to upload."""
    if not data:
        return "The image is empty."
    if len(data) > MAX_IMAGE_BYTES:
        return "The image is larger than 5 MB."
    if detect_image_type(data) is None:
        return "Only JPEG, PNG or WebP images can be checked."
    return None


class ServiceError(Exception):
    """A service call failed. `message` is safe to show to the user; `status` is the HTTP status if any."""

    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.status = status


def _error_message(status: int, label: str) -> str:
    if status in (401, 403):
        return f"The {label} needs you to be logged in."
    if status == 429:
        return "Too many checks right now. Please wait a minute and try again."
    if status == 413:
        return "The image is larger than 5 MB."
    if status == 415:
        return "Only JPEG, PNG or WebP images can be checked."
    if status in (400, 422):
        return f"The {label} could not process this input."
    return f"The {label} is not available right now."


async def call_service(
    method: str,
    url: str,
    *,
    label: str,
    timeout: float,
    client: Optional[httpx.AsyncClient] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """Call a FraudAware service and return its JSON body. Raises ServiceError on any failure."""
    try:
        if client is None:
            async with httpx.AsyncClient(timeout=timeout) as own_client:
                response = await own_client.request(method, url, **kwargs)
        else:
            response = await client.request(method, url, timeout=timeout, **kwargs)
    except httpx.TimeoutException:
        logger.warning("%s timed out after %ss: %s", label, timeout, url)
        raise ServiceError(f"The {label} took too long to answer.")
    except httpx.HTTPError as e:
        logger.warning("%s unreachable: %s (%s)", label, url, type(e).__name__)
        raise ServiceError(f"The {label} is not available right now.")

    if response.status_code >= 400:
        logger.warning("%s returned HTTP %s: %s", label, response.status_code, url)
        raise ServiceError(_error_message(response.status_code, label), status=response.status_code)

    try:
        data = response.json()
    except ValueError:
        data = None
    if not isinstance(data, dict):
        raise ServiceError(f"The {label} returned an answer we could not read.")
    return data


def percent(value: Any) -> Optional[int]:
    """0.873 -> 87. None if the value is not a number."""
    try:
        return int(round(float(value) * 100))
    except (TypeError, ValueError):
        return None
