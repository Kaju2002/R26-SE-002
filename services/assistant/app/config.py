# app/config.py
# Assistant settings, read once from environment variables (.env locally, Railway later).

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# This service's own .env, not whichever directory the process was started from.
# override=True so an empty inherited CORS_ORIGINS does not hide the file.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)


def _url(name: str, default: str) -> str:
    return (os.getenv(name) or default).strip().rstrip("/")


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    scam_detection_url: str
    employer_verification_url: str
    fake_job_detection_url: str
    user_management_url: str
    job_management_url: str
    job_recommendation_url: str
    llm_provider: str
    gemini_model: str
    gemini_api_key: str = field(repr=False)
    jwt_secret: str = field(default="", repr=False)
    cors_origins: tuple = ()
    health_timeout_seconds: float = 3.0
    job_post_timeout_seconds: float = 90.0
    employer_check_timeout_seconds: float = 90.0
    recruiter_check_timeout_seconds: float = 60.0
    llm_timeout_seconds: float = 20.0
    # Empty: conversations are kept in memory only (lost on restart).
    mongo_uri: str = field(default="", repr=False)
    mongo_db: str = "fraudaware"
    # 0 turns a limit off.
    rate_limit_per_minute: int = 10
    rate_limit_per_day: int = 150
    llm_calls_per_minute: int = 8
    llm_calls_per_user_per_day: int = 60

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
        user_management_url=_url("USER_MANAGEMENT_URL", "http://127.0.0.1:5000"),
        job_management_url=_url("JOB_MANAGEMENT_URL", "http://127.0.0.1:5001"),
        job_recommendation_url=_url("JOB_RECOMMENDATION_URL", "http://127.0.0.1:8002"),
        llm_provider=(os.getenv("LLM_PROVIDER") or "gemini").strip().lower(),
        gemini_model=(os.getenv("GEMINI_MODEL") or "").strip(),
        gemini_api_key=(os.getenv("GEMINI_API_KEY") or "").strip(),
        jwt_secret=(os.getenv("JWT_SECRET") or "").strip(),
        cors_origins=tuple(o.strip().rstrip("/") for o in cors.split(",") if o.strip()),
        health_timeout_seconds=_float("HEALTH_TIMEOUT_SECONDS", 3.0),
        # Image job posts include OCR and LIME/SHAP explanations, so they can be slow.
        job_post_timeout_seconds=_float("JOB_POST_TIMEOUT_SECONDS", 90.0),
        # Employer verification scrapes websites and registers.
        employer_check_timeout_seconds=_float("EMPLOYER_CHECK_TIMEOUT_SECONDS", 90.0),
        recruiter_check_timeout_seconds=_float("RECRUITER_CHECK_TIMEOUT_SECONDS", 60.0),
        llm_timeout_seconds=_float("LLM_TIMEOUT_SECONDS", 20.0),
        mongo_uri=(os.getenv("MONGO_URI") or "").strip(),
        mongo_db=(os.getenv("MONGO_DB") or "fraudaware").strip(),
        # Messages per user; over the limit the app gets HTTP 429.
        rate_limit_per_minute=_int("RATE_LIMIT_PER_MINUTE", 10),
        rate_limit_per_day=_int("RATE_LIMIT_PER_DAY", 150),
        # Gemini calls (all users per minute, each user per day); over the limit guided mode answers.
        llm_calls_per_minute=_int("LLM_CALLS_PER_MINUTE", 8),
        llm_calls_per_user_per_day=_int("LLM_CALLS_PER_USER_PER_DAY", 60),
    )
