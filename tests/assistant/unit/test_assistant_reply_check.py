"""
Unit tests for the post-LLM check: replies that call the offer safe or a scam against the
check results are caught; fair per-check sentences and negations are not.
"""

from __future__ import annotations

import sys

import pytest


@pytest.fixture
def rc():
    from tests.service_imports import import_module

    # One import, so CaseState, CheckResult and combine come from the same module copies.
    return import_module("assistant", "app.reply_check")


def _case(**risks):
    case = sys.modules["app.case_state"].CaseState()
    for source, risk in risks.items():
        case.set(sys.modules["app.schemas"].CheckResult(source=source, status="done", risk=risk))
    return case


def _verdict(case):
    return sys.modules["app.verdict"].combine(case.as_list())


SAFE_CLAIMS = [
    "Good news, this job looks legit!",
    "It's safe.",
    "The job offer seems genuine.",
    "This is not a scam.",
    "Everything appears to be completely legitimate.",
    "You can go ahead, it is safe to pay the fee.",
    "There's nothing to worry about.",
]
SCAM_CLAIMS = [
    "This is definitely a scam.",
    "The job post is fake.",
    "It's a scam, don't apply.",
    "This offer looks fraudulent.",
    "This job is high-risk.",
]
FAIR = [
    "This job post shows strong warning signs. Never pay a fee.",
    "It is not safe to pay any fee to a recruiter.",
    "This job doesn't look safe.",
    "The company check found no warning signs, but the job post did.",
    "Scammers often copy real companies, so let's check the recruiter's messages too.",
    "I can't say whether it's safe yet.",
]


@pytest.mark.parametrize("reply", SAFE_CLAIMS)
def test_safe_claim_with_warning_signs_is_a_contradiction(rc, reply):
    assert rc.contradicts(reply, _case(job_post="high"), None)


@pytest.mark.parametrize("reply", SAFE_CLAIMS)
def test_safe_claim_before_any_check_is_a_contradiction(rc, reply):
    assert rc.contradicts(reply, _case(), None)


@pytest.mark.parametrize("reply", SAFE_CLAIMS)
def test_safe_claim_with_only_low_results_is_allowed(rc, reply):
    assert not rc.contradicts(reply, _case(job_post="low"), None)


@pytest.mark.parametrize("reply", SCAM_CLAIMS)
def test_scam_claim_without_warning_signs_is_a_contradiction(rc, reply):
    assert rc.contradicts(reply, _case(job_post="low", company="low"), None)


@pytest.mark.parametrize("reply", SCAM_CLAIMS)
def test_scam_claim_with_warning_signs_is_allowed(rc, reply):
    assert not rc.contradicts(reply, _case(job_post="medium"), None)


@pytest.mark.parametrize("reply", FAIR)
def test_fair_sentences_are_allowed(rc, reply):
    assert not rc.contradicts(reply, _case(job_post="high", company="low"), None)


def test_an_invented_fee_request_is_a_contradiction(rc):
    assert rc.contradicts("They asked you to pay a fee.", _case(job_post="low"), None)


def test_a_fee_request_is_allowed_when_the_watchout_says_so(rc):
    case = _case(job_post="high")
    case.get("job_post").reasons = ["Watch-outs: Registration fee required."]
    assert not rc.contradicts("They asked you to pay a registration fee.", case, None)


def test_the_verdict_decides_once_it_exists(rc):
    case = _case(job_post="low", company="low", recruiter_chat="medium")

    assert rc.contradicts("It's safe to apply.", case, _verdict(case))
    assert not rc.contradicts("This job is high risk.", case, _verdict(case))
