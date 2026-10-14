# app/schemas.py
# Request / response models for the assistant API.

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ServiceStatus = Literal["up", "down"]


class LlmStatus(BaseModel):
    provider: str
    configured: bool
    model: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    llm: LlmStatus
    services: Dict[str, ServiceStatus]


# ─── CHECKS ──────────────────────────────────────────────────────

CheckSource = Literal["job_post", "company", "recruiter_chat"]

# missing: not asked/answered yet; running: background check in progress;
# not_applicable: e.g. the recruiter never contacted the user (not a skip).
CheckStatus = Literal["missing", "running", "done", "skipped", "not_applicable", "failed"]

Risk = Literal["high", "medium", "low", "unknown"]


class CheckResult(BaseModel):
    """One check's outcome in the common format every tool adapter returns."""

    source: CheckSource
    status: CheckStatus = "missing"
    risk: Optional[Risk] = None
    reasons: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)


# ─── VERDICT ─────────────────────────────────────────────────────

VerdictLevel = Literal["high_risk", "be_careful", "no_warning_signs_partial", "no_warning_signs"]


class Verdict(BaseModel):
    level: VerdictLevel
    title: str
    colour: Literal["red", "orange", "grey", "green"]
    partial: bool
    note: Optional[str] = None
    not_checked: List[CheckSource] = Field(default_factory=list)
    checks: List[CheckResult]
    disclaimer: str


# ─── CHAT ────────────────────────────────────────────────────────

# What the assistant is waiting for next.
Awaiting = Literal[
    "menu",
    "input_type",  # the user sent content first; asking whether it is a post, company or messages
    "job_post",
    "company",
    "recruiter_question",
    "recruiter_chat",
    "waiting",  # everything else is answered; a background check (company) is still running
    "finished",
]


class Chip(BaseModel):
    """A quick-reply button. The app sends `id` back as `chip`."""

    id: str
    label: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str
    at: datetime


class MessageResponse(BaseModel):
    session_id: str
    reply: str
    chips: List[Chip]
    awaiting: Awaiting
    checks: List[CheckResult]
    # True while a background check runs: the app polls GET /assistant/session/{id} for its result.
    running: bool = False
    result: Optional[Verdict] = None


class SessionView(BaseModel):
    session_id: str
    created_at: datetime
    updated_at: datetime
    awaiting: Awaiting
    messages: List[ChatMessage]
    chips: List[Chip]
    checks: List[CheckResult]
    running: bool = False
    result: Optional[Verdict] = None
