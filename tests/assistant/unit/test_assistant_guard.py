"""
Unit tests for the scope guard's rules: what is let through without asking the LLM.
"""

from __future__ import annotations

import sys

import pytest


@pytest.fixture
def guard():
    from tests.service_imports import import_module

    return import_module("assistant", "app.guard")


def _session(awaiting="menu", **statuses):
    session = sys.modules["app.sessions"].Session(session_id="s", user_id="u", awaiting=awaiting)
    for source, status in statuses.items():
        session.case.mark(source, status)
    return session


ALLOWED_ANYWHERE = [
    "x" * 250,
    "Call me on 0771234567",
    "hr@abc.lk",
    "www.abc-jobs.lk",
    "Rs 5000 per day",
    "They asked for a registration fee",
    "Is this company real?",
    "I got a WhatsApp message",
    "hi",
    "Thank you!",
    "Good morning",
    "How does this work?",
    "Is my data private?",
]
OFF_TOPIC = [
    "Write me a poem about the moon",
    "What is the capital of France",
    "Solve 2x + 3 = 7",
    "Who won the cricket match yesterday",
    "hi can you write my history essay for tomorrow please",
]


@pytest.mark.parametrize("text", ALLOWED_ANYWHERE)
def test_content_greetings_and_app_questions_pass_the_rules(guard, text):
    assert guard.allowed_by_rules(text, _session())


@pytest.mark.parametrize("text", OFF_TOPIC)
def test_off_topic_messages_need_the_classifier(guard, text):
    assert not guard.allowed_by_rules(text, _session())


@pytest.mark.parametrize("awaiting", ["job_post", "company", "recruiter_question", "waiting", "finished"])
def test_short_answers_during_a_check_pass(guard, awaiting):
    assert guard.allowed_by_rules("Kandy Traders", _session(awaiting=awaiting))


def test_short_answers_pass_once_a_check_has_started(guard):
    assert guard.allowed_by_rules("what about the other one", _session(job_post="done"))
    assert not guard.allowed_by_rules("what about the other one", _session())


def test_long_off_topic_message_during_a_check_needs_the_classifier(guard):
    text = "Can you please explain to me how photosynthesis works in plants and why leaves are green"
    assert not guard.allowed_by_rules(text, _session(awaiting="job_post"))


def test_out_of_scope_reply_keeps_the_current_buttons(guard):
    session = _session(awaiting="job_post")
    session.chips = [sys.modules["app.guided"].CHIP_SKIP]

    turn = guard.out_of_scope_turn(session)

    assert turn.reply == guard.OUT_OF_SCOPE_REPLY
    assert [c.id for c in turn.chips] == ["skip"]
    assert session.awaiting == "job_post"
