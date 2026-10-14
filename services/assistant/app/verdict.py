# app/verdict.py
# Combined verdict, computed in code from the check results. The LLM never decides this.
#
# Rule: a warning is always shown; "no warning signs found" needs every applicable check.

from typing import Dict, Iterable, List

from app.schemas import CheckResult, CheckSource, Verdict

CHECK_ORDER: List[CheckSource] = ["job_post", "company", "recruiter_chat"]

CHECK_LABELS: Dict[str, str] = {
    "job_post": "Job post",
    "company": "Company",
    "recruiter_chat": "Recruiter messages",
}

DISCLAIMER = (
    "This is an automated estimate. Always verify the employer before paying "
    "or sharing personal details."
)

_KNOWN_RISKS = ("high", "medium", "low")


def _has_result(check: CheckResult) -> bool:
    return check.status == "done" and check.risk in _KNOWN_RISKS


def _is_not_checked(check: CheckResult) -> bool:
    return check.status != "not_applicable" and not _has_result(check)


def _not_checked_note(not_checked: List[CheckSource]) -> str:
    names = ", ".join(CHECK_LABELS[s].lower() for s in not_checked)
    return f"Based on the checks completed. Not checked: {names}."


def combine(checks: Iterable[CheckResult]) -> Verdict:
    """Combine the per-check results into one result card. Missing sources count as not checked."""
    by_source = {c.source: c for c in checks}
    ordered = [by_source.get(s) or CheckResult(source=s) for s in CHECK_ORDER]

    risks = {c.risk for c in ordered if _has_result(c)}
    not_checked = [c.source for c in ordered if _is_not_checked(c)]
    partial = bool(not_checked)
    note = _not_checked_note(not_checked) if partial else None

    if "high" in risks:
        level, title, colour = "high_risk", "HIGH RISK", "red"
    elif "medium" in risks:
        level, title, colour = "be_careful", "BE CAREFUL", "orange"
    elif not risks:
        level, title, colour = "no_warning_signs_partial", "NO CHECKS COULD BE COMPLETED", "grey"
    elif partial:
        level, title, colour = (
            "no_warning_signs_partial",
            "NO WARNING SIGNS IN THE CHECKS COMPLETED",
            "grey",
        )
    else:
        level, title, colour = "no_warning_signs", "NO WARNING SIGNS FOUND", "green"

    return Verdict(
        level=level,
        title=title,
        colour=colour,
        partial=partial,
        note=note,
        not_checked=not_checked,
        checks=ordered,
        disclaimer=DISCLAIMER,
    )
