# app/schemas.py
# Request / response models for the assistant API.

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
