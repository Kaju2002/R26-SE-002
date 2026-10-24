# app/sessions.py
# Conversation sessions: in memory, and also in MongoDB when MONGO_URI is set.
# Sessions are deleted 24 hours after their last change.

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, PrivateAttr, ValidationError

from app.case_state import CaseState
from app.config import get_settings
from app.redact import redact
from app.schemas import Awaiting, ChatMessage, Chip, Verdict
from app.session_db import SessionDb

logger = logging.getLogger(__name__)

SESSION_MAX_AGE = timedelta(hours=24)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Session(BaseModel):
    session_id: str
    user_id: str
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    awaiting: Awaiting = "menu"
    case: CaseState = Field(default_factory=CaseState)
    messages: List[ChatMessage] = Field(default_factory=list)
    # Buttons for the latest assistant message, so a polling app can show them too.
    chips: List[Chip] = Field(default_factory=list)
    verdict: Optional[Verdict] = None
    # A skill the user asked to add. Saved to the profile only after they say yes.
    pending_skill: Optional[str] = None

    # Content the user sent before saying what it is; kept only until the next message, never stored.
    _pending_text: Optional[str] = PrivateAttr(default=None)
    _pending_image: Optional[bytes] = PrivateAttr(default=None)
    # Background checks still running, by check source.
    _tasks: Dict[str, asyncio.Task] = PrivateAttr(default_factory=dict)

    def add_message(self, role: str, text: str, kind: str = "text") -> None:
        self.messages.append(ChatMessage(role=role, text=text, at=_now(), kind=kind))
        self.updated_at = _now()

    def cancel_tasks(self) -> None:
        """Stop background checks (the conversation was closed); they count as skipped."""
        for source, task in self._tasks.items():
            task.cancel()
            self.case.mark(source, "skipped")
        self._tasks.clear()


class SessionStore:
    """Live sessions stay in memory: background checks and locks need the same object. With a
    database, every change is also saved there, and a session missing from memory (after a
    restart) is loaded from it."""

    def __init__(self, db: Optional[SessionDb] = None) -> None:
        self._db = db
        self._sessions: Dict[str, Session] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    @property
    def kind(self) -> str:
        return "mongodb" if self._db is not None else "memory"

    async def connect(self) -> None:
        if self._db is not None:
            await self._db.connect()

    def create(self, user_id: str) -> Session:
        self._prune()
        session = Session(session_id=uuid.uuid4().hex, user_id=user_id)
        self._sessions[session.session_id] = session
        return session

    async def get(self, session_id: str, user_id: str) -> Optional[Session]:
        """None if the session does not exist, has expired or belongs to someone else."""
        session = self._sessions.get(session_id)
        if session is None and self._db is not None:
            session = await self._load(session_id, user_id)
        if session is None or session.user_id != user_id:
            return None
        return session

    async def save(self, session: Session) -> None:
        if self._db is None:
            return
        document = session.model_dump()
        # Personal data is masked in the saved copy. The copy in memory keeps the original text
        # for the checks, so after a restart older messages can only be checked masked.
        for message in document["messages"]:
            message["text"] = redact(message["text"]).text
        await self._db.save(session.session_id, document)

    async def _load(self, session_id: str, user_id: str) -> Optional[Session]:
        document = await self._db.load(session_id, user_id)
        if document is None:
            return None
        try:
            session = Session.model_validate(document)
        except ValidationError:
            logger.warning("Saved conversation could not be read; ignoring it")
            return None
        if session.updated_at < _now() - SESSION_MAX_AGE:
            return None
        # Another request may have loaded it meanwhile; both must use the same object.
        return self._sessions.setdefault(session_id, session)

    def lock(self, session_id: str) -> asyncio.Lock:
        """One change at a time per session: a double tap must not run a check twice, and a
        finishing background check must not overwrite a message being handled."""
        return self._locks.setdefault(session_id, asyncio.Lock())

    def clear(self) -> None:
        for session in self._sessions.values():
            session.cancel_tasks()
        self._sessions.clear()
        self._locks.clear()

    def _prune(self) -> None:
        cutoff = _now() - SESSION_MAX_AGE
        for session_id in [k for k, s in self._sessions.items() if s.updated_at < cutoff]:
            self._sessions.pop(session_id).cancel_tasks()
            self._locks.pop(session_id, None)


def _make_store() -> SessionStore:
    settings = get_settings()
    if not settings.mongo_uri:
        return SessionStore()
    return SessionStore(SessionDb(settings.mongo_uri, settings.mongo_db, max_age=SESSION_MAX_AGE))


store = _make_store()
