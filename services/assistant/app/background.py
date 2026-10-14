# app/background.py
# Slow checks (the company check can take up to 90 s) run as background tasks so the chat can
# carry on. When one finishes, its result is saved to the session; the app sees it by polling
# GET /assistant/session/{id}.
#
# Tasks live in this server process only: they are lost on restart.

import asyncio
import logging
from typing import Awaitable, Callable

from app.schemas import CheckResult, CheckSource
from app.sessions import Session, store
from app.tools.common import failed
from app.verdict import CHECK_LABELS

logger = logging.getLogger(__name__)

# Added to the service timeout as a last safety net; the service call normally times out first.
GRACE_SECONDS = 5.0

Runner = Callable[[], Awaitable[CheckResult]]
OnFinish = Callable[[Session, CheckResult], None]


def start(session: Session, source: CheckSource, run: Runner, on_finish: OnFinish, *, timeout: float) -> None:
    """Mark the check as running and start it. `on_finish` is called with the session locked."""
    cancel(session, source)
    session.case.mark(source, "running")
    session._tasks[source] = asyncio.create_task(_run(session, source, run, on_finish, timeout + GRACE_SECONDS))


def cancel(session: Session, source: CheckSource) -> None:
    task = session._tasks.pop(source, None)
    if task is not None:
        task.cancel()


async def _run(session: Session, source: CheckSource, run: Runner, on_finish: OnFinish, deadline: float) -> None:
    label = CHECK_LABELS[source].lower()
    try:
        result = await asyncio.wait_for(run(), timeout=deadline)
    except asyncio.TimeoutError:
        result = failed(source, f"The {label} check took too long. Please try again in a moment.")
    except Exception:
        logger.exception("Background %s check crashed", source)
        result = failed(source, f"The {label} check is not available right now.")

    async with store.lock(session.session_id):
        # Skipped, restarted or the conversation was closed while this was running.
        if session._tasks.get(source) is not asyncio.current_task():
            return
        del session._tasks[source]
        on_finish(session, result)
