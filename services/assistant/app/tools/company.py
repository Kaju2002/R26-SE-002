# app/tools/company.py
# Company check: adapter over employer-verification (POST /predict). Slow: it scrapes websites.

from typing import Any, Dict, List, Optional

import httpx

from app.config import get_settings
from app.schemas import CheckResult
from app.tools.common import ServiceError, call_service, done, failed

SOURCE = "company"
LABEL = "company check"
MAX_FIELD_CHARS = 200
MAX_REASONS = 4

# employer-verification's user_result.band is its final decision ("High" without fraud
# evidence is already turned into "Medium" there).
_RISK = {"High": "high", "Medium": "medium", "Low": "low"}


def _clean(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


def _reasons(user_result: Dict[str, Any], risk: str) -> List[str]:
    reasons = [user_result["headline"]] if user_result.get("headline") else []
    wanted = "good" if risk == "low" else "concern"
    reasons += [c["detail"] for c in user_result.get("checks") or [] if c.get("status") == wanted and c.get("detail")]
    reasons += list(user_result.get("notices") or [])
    return reasons[:MAX_REASONS]


def _to_result(data: Dict[str, Any], given: Dict[str, Optional[str]]) -> CheckResult:
    user_result = data.get("user_result") or {}
    band = user_result.get("band") or data.get("risk_level")
    details: Dict[str, Any] = {
        "given": given,
        "band": band,
        "label": user_result.get("label"),
        "score": user_result.get("score"),
        "high_reason": user_result.get("high_reason"),
        "checks": list(user_result.get("checks") or []),
        "next_steps": list(user_result.get("next_steps") or []),
        "website_checked": data.get("website_checked"),
        "cached": bool(data.get("cached")),
    }

    risk = _RISK.get(band)
    if risk is None:
        reason = user_result.get("headline") or "Not enough information to check this company."
        return done(SOURCE, "unknown", [reason], details)
    return done(SOURCE, risk, _reasons(user_result, risk), details)


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
    return _to_result(data, given)
