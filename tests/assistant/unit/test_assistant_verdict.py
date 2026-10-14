"""
Unit tests for the assistant's combined verdict rules (app/verdict.py).
"""

from __future__ import annotations

import pytest


@pytest.fixture(scope="module")
def v():
    from tests.service_imports import import_module

    verdict = import_module("assistant", "app.verdict")
    return verdict, verdict.CheckResult


def _done(cls, source, risk, *reasons):
    return cls(source=source, status="done", risk=risk, reasons=list(reasons))


def test_all_low_is_green(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "low"),
        _done(C, "company", "low"),
        _done(C, "recruiter_chat", "low"),
    ])

    assert (result.level, result.colour) == ("no_warning_signs", "green")
    assert result.partial is False
    assert result.note is None
    assert result.not_checked == []


def test_any_high_is_red(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "low"),
        _done(C, "company", "low"),
        _done(C, "recruiter_chat", "high", "Asks for a registration fee"),
    ])

    assert (result.level, result.colour) == ("high_risk", "red")


def test_high_beats_medium(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "medium"),
        _done(C, "company", "high"),
        _done(C, "recruiter_chat", "low"),
    ])

    assert result.level == "high_risk"


def test_medium_without_high_is_orange(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "medium"),
        _done(C, "company", "low"),
        _done(C, "recruiter_chat", "low"),
    ])

    assert (result.level, result.colour) == ("be_careful", "orange")


def test_scam_with_skipped_check_stays_red_and_partial(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "high"),
        C(source="company", status="skipped"),
        C(source="recruiter_chat", status="skipped"),
    ])

    assert result.colour == "red"
    assert result.partial is True
    assert result.not_checked == ["company", "recruiter_chat"]
    assert result.note == "Based on the checks completed. Not checked: company, recruiter messages."


def test_low_with_skipped_check_is_grey_not_green(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "low"),
        _done(C, "company", "low"),
        C(source="recruiter_chat", status="skipped"),
    ])

    assert (result.level, result.colour) == ("no_warning_signs_partial", "grey")
    assert result.title == "NO WARNING SIGNS IN THE CHECKS COMPLETED"
    assert result.not_checked == ["recruiter_chat"]


def test_not_applicable_is_not_a_skip(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "low"),
        _done(C, "company", "low"),
        C(source="recruiter_chat", status="not_applicable"),
    ])

    assert result.colour == "green"
    assert result.partial is False


@pytest.mark.parametrize("status", ["failed", "running", "missing"])
def test_unfinished_checks_count_as_not_checked(v, status):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "low"),
        C(source="company", status=status),
        _done(C, "recruiter_chat", "low"),
    ])

    assert result.colour == "grey"
    assert result.not_checked == ["company"]


def test_done_with_unknown_risk_counts_as_not_checked(v):
    verdict, C = v
    result = verdict.combine([
        _done(C, "job_post", "low"),
        _done(C, "company", "unknown", "Company check unavailable"),
        _done(C, "recruiter_chat", "low"),
    ])

    assert result.colour == "grey"
    assert result.not_checked == ["company"]


def test_no_completed_checks(v):
    verdict, C = v
    result = verdict.combine([
        C(source="job_post", status="failed"),
        C(source="company", status="skipped"),
    ])

    assert result.colour == "grey"
    assert result.title == "NO CHECKS COULD BE COMPLETED"
    assert result.not_checked == ["job_post", "company", "recruiter_chat"]


def test_checks_are_returned_in_fixed_order_with_missing_filled_in(v):
    verdict, C = v
    result = verdict.combine([_done(C, "recruiter_chat", "high")])

    assert [c.source for c in result.checks] == ["job_post", "company", "recruiter_chat"]
    assert [c.status for c in result.checks] == ["missing", "missing", "done"]
    assert result.colour == "red"


def test_every_verdict_has_the_disclaimer(v):
    verdict, C = v
    result = verdict.combine([_done(C, "job_post", "low")])

    assert result.disclaimer.startswith("This is an automated estimate.")
