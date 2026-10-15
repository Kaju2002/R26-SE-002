"""
API tests for saved conversations (a fake database stands in for MongoDB) and the message limits.
A restart is simulated by dropping everything the server holds in memory.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest


class FakeDb:
    def __init__(self):
        self.documents: dict = {}

    async def load(self, session_id, user_id):
        doc = self.documents.get(session_id)
        return dict(doc) if doc is not None and doc["user_id"] == user_id else None

    async def save(self, session_id, document):
        self.documents[session_id] = document


@pytest.fixture
def saved(chat, monkeypatch):
    chat.db = FakeDb()
    monkeypatch.setattr(chat.main.store, "_db", chat.db)
    return chat


def restart(chat):
    """What a server restart loses: sessions in memory, locks and running background checks."""
    store = chat.main.store
    for session in store._sessions.values():
        for task in session._tasks.values():
            task.cancel()
    store._sessions.clear()
    store._locks.clear()
    chat.settle()


def _status(body):
    return {c["source"]: c["status"] for c in body["checks"]}


def test_every_reply_is_saved(saved):
    sid = saved.send()["session_id"]
    saved.send(sid, chip="check_job_post")

    doc = saved.db.documents[sid]
    assert doc["user_id"] == "user-a"
    assert doc["awaiting"] == "job_post"
    assert [m["role"] for m in doc["messages"]] == ["assistant", "user", "assistant"]


def test_conversation_continues_after_a_restart(saved):
    sid = saved.send()["session_id"]
    saved.send(sid, chip="check_job_post")
    restart(saved)

    body = saved.send(sid, text="Earn Rs 5,000 daily from home")

    assert saved.calls == [("job_post", "text", "Earn Rs 5,000 daily from home")]
    assert _status(body)["job_post"] == "done"
    assert len(saved.session(sid)["messages"]) == 5


def test_other_users_cannot_open_a_saved_conversation(saved):
    sid = saved.send()["session_id"]
    restart(saved)

    res = saved.request("GET", f"/assistant/session/{sid}", token=saved.token("user-b"))

    assert res.status_code == 404


def test_company_check_interrupted_by_a_restart_is_reported_as_failed(saved):
    saved.hold_company()
    sid = saved.send()["session_id"]
    saved.send(sid, chip="check_company")
    assert saved.send(sid, text="Company: ABC Holdings")["running"] is True
    restart(saved)

    view = saved.session(sid)

    assert view["running"] is False
    assert _status(view)["company"] == "failed"
    assert view["messages"][-1]["text"].startswith(
        "I couldn't complete the company check: The company check was interrupted. Please try again."
    )
    assert saved.db.documents[sid]["case"]["checks"]["company"]["status"] == "failed"


def test_interrupted_check_is_told_in_the_next_reply(saved):
    saved.hold_company()
    sid = saved.send()["session_id"]
    saved.send(sid, chip="check_company")
    saved.send(sid, text="Company: ABC Holdings")
    saved.send(sid, chip="skip")  # job post
    assert saved.send(sid, chip="recruiter_no")["awaiting"] == "waiting"
    restart(saved)

    body = saved.send(sid, chip="skip")

    assert body["reply"].startswith("I couldn't complete the company check: The company check was interrupted.")
    assert "Okay, I skipped the company check." in body["reply"]
    assert body["result"] is not None
    # One reply for one message, as the app expects.
    assert saved.session(sid)["messages"][-1]["text"] == body["reply"]


def test_content_waiting_for_its_type_is_not_kept_after_a_restart(saved):
    sid = saved.send()["session_id"]
    saved.send(sid, text="Earn Rs 5,000 daily from home")
    restart(saved)

    body = saved.send(sid, chip="is_job_post")

    assert body["reply"].startswith("Sorry, I no longer have what you sent.")
    assert body["awaiting"] == "job_post"
    assert saved.calls == []


# ─── RATE LIMITS ─────────────────────────────────────────────────


def _limits(chat, monkeypatch, **numbers):
    settings = SimpleNamespace(
        rate_limit_per_minute=0, rate_limit_per_day=0, llm_calls_per_minute=0, llm_calls_per_user_per_day=0
    )
    for name, value in numbers.items():
        setattr(settings, name, value)
    monkeypatch.setattr(chat.main.rate_limit, "limits", chat.main.rate_limit.Limits(settings))


def test_too_many_messages_get_429(chat, monkeypatch):
    _limits(chat, monkeypatch, rate_limit_per_minute=2)
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")

    res = chat.request("POST", "/assistant/message", data={"session_id": sid, "text": "hello"})

    assert res.status_code == 429
    assert res.json()["detail"] == chat.main.rate_limit.TOO_FAST
    assert res.headers["retry-after"] == "60"
    assert chat.calls == []


def test_message_limit_is_per_user(chat, monkeypatch):
    _limits(chat, monkeypatch, rate_limit_per_minute=1)
    chat.send()

    res = chat.request("POST", "/assistant/message", token=chat.token("user-b"))

    assert res.status_code == 200
