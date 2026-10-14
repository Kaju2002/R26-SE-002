# app/schemas.py
# Request / response models for the assistant API.

from typing import Dict, Literal

from pydantic import BaseModel

ServiceStatus = Literal["up", "down"]


class LlmStatus(BaseModel):
    provider: str
    configured: bool
    model: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    llm: LlmStatus
    services: Dict[str, ServiceStatus]
