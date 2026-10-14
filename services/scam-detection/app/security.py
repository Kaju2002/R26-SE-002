# app/security.py
# Caller authentication (user JWT or internal service key) and per-user rate limiting.

import hmac
import os
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()


@dataclass(frozen=True)
class Caller:
    """Who is calling: a logged-in user (user_id set) or a trusted FraudAware service."""

    user_id: Optional[str]
    internal: bool


def _jwt_secret() -> str:
    return (os.getenv("JWT_SECRET") or "").strip()


def _internal_key() -> str:
    return (os.getenv("INTERNAL_SERVICE_KEY") or "").strip()


def _user_id_from_bearer(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided. Please login.")

    secret = _jwt_secret()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured on the scam-detection service.",
        )

    token = authorization[len("Bearer "):].strip()
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please login again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")

    user_id = str(payload.get("userId") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload.")
    return user_id


def require_user(authorization: Optional[str] = Header(default=None)) -> str:
    """Routes that read or change one user's saved scans: user JWT only."""
    return _user_id_from_bearer(authorization)


def get_caller(
    authorization: Optional[str] = Header(default=None),
    x_internal_service_key: Optional[str] = Header(default=None),
) -> Caller:
    """Classify routes: a user JWT, or the shared key used by chat-management."""
    provided = (x_internal_service_key or "").strip()
    if provided:
        expected = _internal_key()
        if expected and hmac.compare_digest(provided.encode(), expected.encode()):
            return Caller(user_id=None, internal=True)
        raise HTTPException(status_code=401, detail="Invalid internal service key.")
    return Caller(user_id=_user_id_from_bearer(authorization), internal=False)


# ─── RATE LIMIT ──────────────────────────────────────────────────


class RateLimiter:
    """Sliding-window limiter kept in process memory (per API instance)."""

    def __init__(self, limit: int, window_seconds: float = 60.0):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict = defaultdict(deque)
        self._lock = threading.Lock()

    def retry_after(self, key: str) -> Optional[int]:
        """Record one hit for key. Returns seconds to wait if over the limit, else None."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(1, int(self.window - (now - hits[0])) + 1)
            hits.append(now)
            if len(self._hits) > 10_000:
                for stale in [k for k, v in self._hits.items() if not v]:
                    del self._hits[stale]
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def _limit_from_env() -> int:
    try:
        return max(1, int(os.getenv("SCAM_RATE_LIMIT_PER_MINUTE", "20")))
    except ValueError:
        return 20


analysis_rate_limiter = RateLimiter(limit=_limit_from_env())


def enforce_rate_limit(caller: Caller) -> None:
    """Limit analysis calls per logged-in user. Internal service calls are not limited here."""
    if caller.internal or not caller.user_id:
        return
    wait = analysis_rate_limiter.retry_after(caller.user_id)
    if wait is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many scans. Please wait a minute and try again.",
            headers={"Retry-After": str(wait)},
        )
