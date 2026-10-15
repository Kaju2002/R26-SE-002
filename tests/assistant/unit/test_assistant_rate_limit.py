"""
Unit tests for the in-memory rate limits, with a fake clock.
"""

from __future__ import annotations

import asyncio
import sys
from types import SimpleNamespace

import pytest


@pytest.fixture
def rate_limit():
    from tests.service_imports import import_module

    import_module("assistant", "app.config").get_settings.cache_clear()
    return import_module("assistant", "app.rate_limit")


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def _settings(per_minute=0, per_day=0, llm_per_minute=0, llm_per_day=0):
    return SimpleNamespace(
        rate_limit_per_minute=per_minute,
        rate_limit_per_day=per_day,
        llm_calls_per_minute=llm_per_minute,
        llm_calls_per_user_per_day=llm_per_day,
    )


def _hit(limiter, key):
    if not limiter.allows(key):
        return False
    limiter.add(key)
    return True


def test_limiter_refuses_over_the_limit_until_the_period_passes(rate_limit):
    clock = Clock()
    limiter = rate_limit.Limiter(2, 60, clock)

    assert _hit(limiter, "a") and _hit(limiter, "a")
    assert not _hit(limiter, "a")
    assert _hit(limiter, "b")  # other keys are counted separately

    clock.now += 60
    assert _hit(limiter, "a")


def test_zero_turns_a_limit_off(rate_limit):
    limiter = rate_limit.Limiter(0, 60, Clock())

    assert all(_hit(limiter, "a") for _ in range(1000))


def test_idle_keys_are_dropped(rate_limit):
    clock = Clock()
    limiter = rate_limit.Limiter(5, 60, clock)
    _hit(limiter, "old")
    clock.now += 61

    _hit(limiter, "new")

    assert list(limiter._hits) == ["new"]


def test_message_limits_per_minute_then_per_day(rate_limit):
    clock = Clock()
    limits = rate_limit.Limits(_settings(per_minute=2, per_day=3), clock)

    assert limits.message_refused("u") is None
    assert limits.message_refused("u") is None
    assert limits.message_refused("u") == rate_limit.TOO_FAST
    assert limits.message_refused("other") is None

    clock.now += 60
    assert limits.message_refused("u") is None
    assert limits.message_refused("u") == rate_limit.DAILY_LIMIT

    clock.now += 24 * 60 * 60
    assert limits.message_refused("u") is None


def test_refused_messages_do_not_use_up_the_daily_limit(rate_limit):
    clock = Clock()
    limits = rate_limit.Limits(_settings(per_minute=1, per_day=2), clock)
    limits.message_refused("u")
    for _ in range(5):
        assert limits.message_refused("u") == rate_limit.TOO_FAST

    clock.now += 60
    assert limits.message_refused("u") is None


def test_llm_minute_limit_is_shared_by_all_users(rate_limit):
    clock = Clock()
    limits = rate_limit.Limits(_settings(llm_per_minute=2), clock)

    assert limits.take_llm_call("a") and limits.take_llm_call("b")
    assert not limits.take_llm_call("c")
    clock.now += 60
    assert limits.take_llm_call("c")


def test_llm_daily_limit_is_per_user(rate_limit):
    limits = rate_limit.Limits(_settings(llm_per_day=1), Clock())

    assert limits.take_llm_call("a")
    assert not limits.take_llm_call("a")
    assert limits.take_llm_call("b")


def test_limited_client_fails_like_an_unavailable_llm(rate_limit, monkeypatch):
    llm = sys.modules["app.llm"]
    monkeypatch.setattr(rate_limit, "limits", rate_limit.Limits(_settings(llm_per_day=1), Clock()))
    sent = []

    class Fake:
        async def generate(self, system, messages, tools, **kwargs):
            sent.append(kwargs)
            return "reply"

    client = rate_limit.LimitedClient(Fake(), "u")

    assert asyncio.run(client.generate("s", [], None, temperature=0.0)) == "reply"
    with pytest.raises(llm.LlmUnavailable):
        asyncio.run(client.generate("s", [], None))
    assert sent == [{"temperature": 0.0}]
