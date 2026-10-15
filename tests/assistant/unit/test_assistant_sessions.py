"""
Unit tests for the session store with a fake database: what is saved, and loading after a restart.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

import pytest


@pytest.fixture
def sessions():
    from tests.service_imports import import_module

    import_module("assistant", "app.config").get_settings.cache_clear()
    return import_module("assistant", "app.sessions")


class FakeDb:
    """Keeps documents like MongoDB would: a copy per session id, filtered by user."""

    def __init__(self):
        self.documents: dict = {}

    async def load(self, session_id, user_id):
        doc = self.documents.get(session_id)
        return dict(doc) if doc is not None and doc["user_id"] == user_id else None

    async def save(self, session_id, document):
        self.documents[session_id] = document


def _saved_session(sessions, db):
    store = sessions.SessionStore(db)
    session = store.create("user-a")
    session.awaiting = "company"
    session.add_message("user", "Earn Rs 5,000 daily")
    session.case.mark("job_post", "done")
    asyncio.run(store.save(session))
    return session


def test_memory_store_is_used_without_a_uri(sessions):
    assert sessions.store.kind == "memory"


def test_conversation_is_loaded_after_a_restart(sessions):
    db = FakeDb()
    saved = _saved_session(sessions, db)

    restarted = sessions.SessionStore(db)
    session = asyncio.run(restarted.get(saved.session_id, "user-a"))

    assert session is not None
    assert session.awaiting == "company"
    assert [m.text for m in session.messages] == ["Earn Rs 5,000 daily"]
    assert session.case.get("job_post").status == "done"
    assert session.updated_at.tzinfo is not None


def test_loaded_session_is_kept_in_memory(sessions):
    db = FakeDb()
    saved = _saved_session(sessions, db)
    restarted = sessions.SessionStore(db)

    first = asyncio.run(restarted.get(saved.session_id, "user-a"))
    second = asyncio.run(restarted.get(saved.session_id, "user-a"))

    assert first is second


def test_other_users_cannot_load_a_saved_session(sessions):
    db = FakeDb()
    saved = _saved_session(sessions, db)

    assert asyncio.run(sessions.SessionStore(db).get(saved.session_id, "user-b")) is None


def test_expired_session_is_not_loaded(sessions):
    db = FakeDb()
    saved = _saved_session(sessions, db)
    db.documents[saved.session_id]["updated_at"] -= timedelta(hours=25)

    assert asyncio.run(sessions.SessionStore(db).get(saved.session_id, "user-a")) is None


def test_unreadable_document_is_ignored(sessions):
    db = FakeDb()
    saved = _saved_session(sessions, db)
    db.documents[saved.session_id]["awaiting"] = "something-new"

    assert asyncio.run(sessions.SessionStore(db).get(saved.session_id, "user-a")) is None


def test_pending_content_and_images_are_never_saved(sessions):
    db = FakeDb()
    store = sessions.SessionStore(db)
    session = store.create("user-a")
    session._pending_text = "secret pending text"
    session._pending_image = b"\x89PNG image bytes"

    asyncio.run(store.save(session))

    saved = repr(db.documents[session.session_id])
    assert "secret pending text" not in saved
    assert "PNG image bytes" not in saved


def test_personal_data_is_masked_in_the_saved_copy_only(sessions):
    db = FakeDb()
    store = sessions.SessionStore(db)
    session = store.create("user-a")
    session.add_message("user", "Call 0771234567 or mail hr@abc-jobs.lk, fee Rs 2,500")

    asyncio.run(store.save(session))

    saved = db.documents[session.session_id]["messages"][0]["text"]
    assert "0771234567" not in saved and "hr@" not in saved
    assert "Rs 2,500" in saved and "abc-jobs.lk" in saved
    assert "0771234567" in session.messages[0].text


@pytest.mark.parametrize("uri", ["mongodb://user:password@host:notaport", "mongodb+srv://user:password@a:1"])
def test_database_errors_do_not_break_the_chat_or_leak_the_uri(caplog, uri):
    from tests.service_imports import import_module

    session_db = import_module("assistant", "app.session_db")
    db = session_db.SessionDb(uri, "fraudaware", max_age=timedelta(hours=24))

    with caplog.at_level(logging.WARNING):
        assert asyncio.run(db.load("s", "u")) is None

    assert "Could not load a conversation from MongoDB" in caplog.text
    assert "password" not in caplog.text


def test_mongodb_is_left_alone_for_a_minute_after_an_error(monkeypatch):
    from tests.service_imports import import_module

    session_db = import_module("assistant", "app.session_db")
    now = [1000.0]
    monkeypatch.setattr(session_db.time, "monotonic", lambda: now[0])
    db = session_db.SessionDb("mongodb://unused", "fraudaware", max_age=timedelta(hours=24))
    attempts = []

    async def unreachable():
        attempts.append(now[0])
        raise TimeoutError("timed out")

    monkeypatch.setattr(db, "_ready", unreachable)

    asyncio.run(db.save("s", {}))
    asyncio.run(db.save("s", {}))
    now[0] += session_db.RETRY_AFTER_SECONDS
    asyncio.run(db.load("s", "u"))

    assert attempts == [1000.0, 1000.0 + session_db.RETRY_AFTER_SECONDS]
