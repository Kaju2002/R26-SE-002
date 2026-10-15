# app/session_db.py
# Conversations saved in MongoDB (collection "assistant_sessions"), so they survive a restart.
# A TTL index makes MongoDB delete each conversation 24 hours after its last change.
#
# MongoDB problems never break the chat: they are logged, the in-memory copy is used, and
# MongoDB is left alone for a minute so every message does not wait for another timeout.

import logging
import time
from datetime import timedelta
from typing import Any, Dict, Optional

from pymongo import AsyncMongoClient

logger = logging.getLogger(__name__)

COLLECTION = "assistant_sessions"
# The first connection to Atlas (DNS, TLS, login) can take several seconds on a slow network.
TIMEOUT_MS = 15_000
RETRY_AFTER_SECONDS = 60.0


class SessionDb:
    def __init__(self, uri: str, database: str, *, max_age: timedelta) -> None:
        self._uri = uri
        self._database = database
        self._max_age = max_age
        self._collection = None
        self._down_until = 0.0

    async def connect(self) -> None:
        """Connect and create the index now, so the first message does not wait for it."""
        await self._run("connect to", self._ready)

    async def load(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        async def find():
            return await (await self._ready()).find_one({"_id": session_id, "user_id": user_id})

        return await self._run("load a conversation from", find)

    async def save(self, session_id: str, document: Dict[str, Any]) -> None:
        async def replace():
            await (await self._ready()).replace_one({"_id": session_id}, document, upsert=True)

        await self._run("save a conversation to", replace)

    async def _ready(self):
        # Created on first use: a wrong or unreachable URI must not stop the server from starting.
        if self._collection is None:
            client = AsyncMongoClient(
                self._uri, tz_aware=True, serverSelectionTimeoutMS=TIMEOUT_MS, timeoutMS=TIMEOUT_MS
            )
            collection = client[self._database][COLLECTION]
            await collection.create_index("updated_at", expireAfterSeconds=int(self._max_age.total_seconds()))
            self._collection = collection
        return self._collection

    async def _run(self, action: str, operation):
        if time.monotonic() < self._down_until:
            return None
        try:
            return await operation()
        except Exception as e:  # a bad MONGO_URI raises ValueError as well as PyMongoError
            self._down_until = time.monotonic() + RETRY_AFTER_SECONDS
            # Only the error type: the message can contain the connection string.
            logger.warning("Could not %s MongoDB (%s); trying again in a minute", action, type(e).__name__)
            return None
