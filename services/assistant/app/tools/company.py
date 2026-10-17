# app/tools/company.py
# Company check: adapter over employer-verification (POST /predict). Slow: it scrapes websites.

from typing import Any, Dict, List, Optional

import httpx

from app import url_safety
from app.config import get_settings
from app.schemas import CheckResult
from app.tools.common import ServiceError, call_service, done, failed

SOURCE = "company"
LABEL = "company check"
MAX_FIELD_CHARS = 200
MAX_REASONS = 6
_CAUTION = (
    "This result is less reliable because little information was found. "
    "A registration on its own does not mean the job offer is safe."
)

# employer-verification's user_result.band is its final decision ("High" without fraud
# evidence is already turned into "Medium" there).
_RISK = {"High": "high", "Medium": "medium", "Low": "low"}


def _clean(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


def _text(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    return _clean(value)


def _registration(data: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """Registered name, number and register, from the top level or from evidence."""
    evidence = data.get("evidence") if isinstance(data.get("evidence"), dict) else {}
    return {
        "reg_name": _text(data.get("reg_name")) or _text(evidence.get("reg_name")),
        "reg_number": _text(data.get("reg_number")) or _text(evidence.get("reg_number")),
        "register": (
            _text(data.get("government_registration_source"))
            or _text(evidence.get("government_registration_source"))
        ),
    }


def _registration_line(registration: Dict[str, Optional[str]]) -> Optional[str]:
    name, number, register = registration["reg_name"], registration["reg_number"], registration["register"]
    if name and number and register:
        return f"Registered as {name}, number {number}, on {register}."
    if name and number:
        return f"Registered as {name}, number {number}."
    if name:
        return f"Registered as {name}."
    if number:
        return f"Registration number {number}."
    return None


def _next_step(user_result: Dict[str, Any]) -> Optional[str]:
    for step in user_result.get("next_steps") or []:
        text = _text(step)
        if text:
            return text
    return None


def _reasons(data: Dict[str, Any], user_result: Dict[str, Any], risk: str) -> List[str]:
    """Headline, then registration, a caution when evidence is thin, check lines, and one next step.

    The registration line, the caution and the next step are kept even when the list is shortened.
    """
    head: List[str] = []
    headline = _text(user_result.get("headline"))
    if headline:
        head.append(headline)
    registration = _registration_line(_registration(data))
    if registration:
        head.append(registration)
    if user_result.get("low_confidence") or user_result.get("thin_evidence"):
        head.append(_CAUTION)

    wanted = "good" if risk == "low" else "concern"
    middle = [c["detail"] for c in user_result.get("checks") or [] if c.get("status") == wanted and c.get("detail")]
    middle += [notice for notice in (user_result.get("notices") or []) if _text(notice)]
    step = _next_step(user_result)
    tail = [step] if step else []

    room = MAX_REASONS - len(head) - len(tail)
    if room < 0:
        return (head + tail)[:MAX_REASONS]
    return head + middle[:room] + tail


def _to_result(data: Dict[str, Any], given: Dict[str, Optional[str]]) -> CheckResult:
    user_result = data.get("user_result") or {}
    band = user_result.get("band") or data.get("risk_level")
    registration = _registration(data)
    details: Dict[str, Any] = {
        "given": given,
        "band": band,
        "label": user_result.get("label"),
        "score": user_result.get("score"),
        "high_reason": user_result.get("high_reason"),
        "low_confidence": bool(user_result.get("low_confidence")),
        "thin_evidence": bool(user_result.get("thin_evidence")),
        "checks": list(user_result.get("checks") or []),
        "next_steps": list(user_result.get("next_steps") or []),
        "website_checked": data.get("website_checked"),
        "cached": bool(data.get("cached")),
        **registration,
    }

    risk = _RISK.get(band)
    if risk is None:
        reason = user_result.get("headline") or "Not enough information to check this company."
        return done(SOURCE, "unknown", [reason], details)
    return done(SOURCE, risk, _reasons(data, user_result, risk), details)


async def check_company(
    company_name: Optional[str] = None,
    website_url: Optional[str] = None,
    email: Optional[str] = None,
    *,
    client: Optional[httpx.AsyncClient] = None,
) -> CheckResult:
    given = {"company_name": _clean(company_name), "website_url": _clean(website_url), "email": _clean(email)}
    if not any(given.values()):
        return failed(SOURCE, "Please give at least the company name, website or email.")
    if any(v and len(v) > MAX_FIELD_CHARS for v in given.values()):
        return failed(SOURCE, f"Company details must be shorter than {MAX_FIELD_CHARS} characters each.")

    not_checked = await _drop_unsafe_addresses(given)
    if not any(given.values()):
        return failed(SOURCE, f"{not_checked[0]} Please send the company name instead.")

    s = get_settings()
    try:
        data = await call_service(
            "POST",
            f"{s.employer_verification_url}/predict",
            label=LABEL,
            timeout=s.employer_check_timeout_seconds,
            client=client,
            json=given,
        )
    except ServiceError as e:
        return failed(SOURCE, e.message, given=given)
    result = _to_result(data, given)
    result.reasons += not_checked
    return result


async def _drop_unsafe_addresses(given: Dict[str, Optional[str]]) -> List[str]:
    """Remove a website or email domain that points to a private network; say what was left out."""
    not_checked = []
    if given["website_url"]:
        problem = await url_safety.website_problem(given["website_url"])
        if problem:
            given["website_url"] = None
            not_checked.append(f"The website was not checked because {problem}.")
    if given["email"]:
        problem = await url_safety.email_problem(given["email"])
        if problem:
            given["email"] = None
            not_checked.append(f"The email address was not checked because {problem}.")
    return not_checked
