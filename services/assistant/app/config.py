# app/config.py
# Assistant settings, read once from environment variables (.env locally, Railway later).

import os
from dataclasses import dataclass, field
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _url(name: str, default: str) -> str:
    return (os.getenv(name) or default).strip().rstrip("/")


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    scam_detection_url: str
    employer_verification_url: str
    fake_job_detection_url: str
    llm_provider: str
    gemini_model: str
    gemini_api_key: str = field(repr=False)
    cors_origins: tuple = ()
    health_timeout_seconds: float = 3.0

    @property
    def llm_configured(self) -> bool:
        return self.llm_provider == "gemini" and bool(self.gemini_api_key and self.gemini_model)


@lru_cache
def get_settings() -> Settings:
    cors = os.getenv("CORS_ORIGINS", "")
    return Settings(
        scam_detection_url=_url("SCAM_DETECTION_URL", "http://127.0.0.1:8000"),
        employer_verification_url=_url("EMPLOYER_VERIFICATION_URL", "http://127.0.0.1:8001"),
        fake_job_detection_url=_url("FAKE_JOB_DETECTION_URL", "http://127.0.0.1:8003"),
        llm_provider=(os.getenv("LLM_PROVIDER") or "gemini").strip().lower(),
        gemini_model=(os.getenv("GEMINI_MODEL") or "").strip(),
        gemini_api_key=(os.getenv("GEMINI_API_KEY") or "").strip(),
        cors_origins=tuple(o.strip().rstrip("/") for o in cors.split(",") if o.strip()),
        health_timeout_seconds=_float("HEALTH_TIMEOUT_SECONDS", 3.0),
    )
