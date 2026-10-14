# app/sessions.py
# Conversation sessions, kept in memory for now (lost on restart). MongoDB comes later.

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, PrivateAttr

from app.case_state import CaseState
from app.schemas import Awaiting, ChatMessage, Verdict

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
    verdict: Optional[Verdict] = None

    # Content the user sent before saying what it is; kept only until the next message, never stored.
    _pending_text: Optional[str] = PrivateAttr(default=None)
    _pending_image: Optional[bytes] = PrivateAttr(default=None)

    def add_message(self, role: str, text: str) -> None:
        self.messages.append(ChatMessage(role=role, text=text, at=_now()))
        self.updated_at = _now()


class SessionStore:
    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    def create(self, user_id: str) -> Session:
        self._prune()
        session = Session(session_id=uuid.uuid4().hex, user_id=user_id)
        self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str, user_id: str) -> Optional[Session]:
        """None if the session does not exist or belongs to someone else."""
        session = self._sessions.get(session_id)
        if session is None or session.user_id != user_id:
            return None
        return session

    def lock(self, session_id: str) -> asyncio.Lock:
        """One message at a time per session (a double tap must not run a check twice)."""
        return self._locks.setdefault(session_id, asyncio.Lock())

    def clear(self) -> None:
        self._sessions.clear()
        self._locks.clear()

    def _prune(self) -> None:
        cutoff = _now() - SESSION_MAX_AGE
        for session_id in [k for k, s in self._sessions.items() if s.updated_at < cutoff]:
            self._sessions.pop(session_id, None)
            self._locks.pop(session_id, None)


store = SessionStore()
