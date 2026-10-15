# app/rate_limit.py
# In-memory rate limits (one server process; counts restart with the server).
# Messages over the limit are refused with HTTP 429. Gemini calls over the limit fail like an
# unavailable LLM, so the conversation carries on in guided mode instead of being blocked.

import logging
import time
from collections import deque
from typing import Callable, Deque, Dict, Optional

from app.config import Settings, get_settings
from app.llm import LlmClient, LlmUnavailable

logger = logging.getLogger(__name__)

MINUTE = 60.0
DAY = 24 * 60 * 60.0
ALL_USERS = "*"

TOO_FAST = "You're sending messages too quickly. Please wait a minute and try again."
DAILY_LIMIT = "You've sent a lot of messages today. Please try again later."


class Limiter:
    """At most `limit` hits per key in any `period` seconds. A limit of 0 or less turns it off."""

    def __init__(self, limit: int, period: float, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.period = period
        self._clock = clock
        self._hits: Dict[str, Deque[float]] = {}
        self._last_sweep = clock()

    def allows(self, key: str) -> bool:
        if self.limit <= 0:
            return True
        hits = self._hits.get(key)
        if not hits:
            return True
        cutoff = self._clock() - self.period
        while hits and hits[0] <= cutoff:
            hits.popleft()
        return len(hits) < self.limit

    def add(self, key: str) -> None:
        if self.limit <= 0:
            return
        now = self._clock()
        self._hits.setdefault(key, deque()).append(now)
        if now - self._last_sweep >= self.period:
            self._last_sweep = now
            cutoff = now - self.period
            for idle in [k for k, hits in self._hits.items() if hits[-1] <= cutoff]:
                del self._hits[idle]


class Limits:
    def __init__(self, settings: Settings, clock: Callable[[], float] = time.monotonic) -> None:
        self.messages_per_minute = Limiter(settings.rate_limit_per_minute, MINUTE, clock)
        self.messages_per_day = Limiter(settings.rate_limit_per_day, DAY, clock)
        self.llm_per_minute = Limiter(settings.llm_calls_per_minute, MINUTE, clock)
        self.llm_per_user_per_day = Limiter(settings.llm_calls_per_user_per_day, DAY, clock)

    def message_refused(self, user_id: str) -> Optional[str]:
        """Counts one message; returns why it is refused, or None."""
        if not self.messages_per_minute.allows(user_id):
            return TOO_FAST
        if not self.messages_per_day.allows(user_id):
            return DAILY_LIMIT
        self.messages_per_minute.add(user_id)
        self.messages_per_day.add(user_id)
        return None

    def take_llm_call(self, user_id: str) -> bool:
        if not (self.llm_per_minute.allows(ALL_USERS) and self.llm_per_user_per_day.allows(user_id)):
            return False
        self.llm_per_minute.add(ALL_USERS)
        self.llm_per_user_per_day.add(user_id)
        return True


limits = Limits(get_settings())


class LimitedClient:
    """The LLM client for one user's request: every call counts against the Gemini limits."""

    def __init__(self, client: LlmClient, user_id: str) -> None:
        self._client = client
        self._user_id = user_id

    async def generate(self, system, messages, tools, **kwargs):
        if not limits.take_llm_call(self._user_id):
            logger.info("Gemini call limit reached; answering in guided mode")
            raise LlmUnavailable("LLM call limit reached")
        return await self._client.generate(system, messages, tools, **kwargs)
