# app/main.py

import asyncio
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import guided
from app.auth import User, get_current_user
from app.config import get_settings
from app.schemas import HealthResponse, MessageResponse, SessionView
from app.sessions import Session, store
from app.tools.common import MAX_IMAGE_BYTES

MAX_TEXT_CHARS = 10_000

app = FastAPI(
    title="FraudAware Assistant API",
    description="Conversational job-scam checker built on the FraudAware detection services",
    version="0.1.0",
)

# The mobile app does not need CORS; only browser origins listed in CORS_ORIGINS may call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


def _dependency_probes() -> dict:
    """Service name -> URL that answers when the service is running."""
    s = get_settings()
    return {
        "scam_detection": f"{s.scam_detection_url}/health",
        "employer_verification": f"{s.employer_verification_url}/",
        "fake_job_detection": f"{s.fake_job_detection_url}/health",
    }


async def _probe(client: httpx.AsyncClient, url: str) -> str:
    try:
        response = await client.get(url)
        return "up" if response.status_code < 500 else "down"
    except httpx.HTTPError:
        return "down"


def _user_message_text(text: Optional[str], image: Optional[bytes], chip: Optional[str]) -> str:
    parts = []
    if chip:
        parts.append(guided.CHIP_LABELS.get(chip, "[button]"))
    if image:
        parts.append("[image]")
    if text:
        parts.append(text)
    return " ".join(parts) or "[opened the assistant]"


def _own_session(session_id: str, user: User) -> Session:
    session = store.get(session_id, user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return session


# ─── ROUTES ──────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health():
    settings = get_settings()
    probes = _dependency_probes()
    async with httpx.AsyncClient(timeout=settings.health_timeout_seconds) as client:
        results = await asyncio.gather(*(_probe(client, url) for url in probes.values()))
    services = dict(zip(probes.keys(), results))

    return {
        "status": "ok" if all(v == "up" for v in services.values()) else "degraded",
        "llm": {
            "provider": settings.llm_provider,
            "configured": settings.llm_configured,
            "model": settings.gemini_model,
        },
        "services": services,
    }


@app.post("/assistant/message", response_model=MessageResponse)
async def assistant_message(
    session_id: Optional[str] = Form(default=None),
    text: Optional[str] = Form(default=None),
    chip: Optional[str] = Form(default=None),
    image: Optional[UploadFile] = File(default=None),
    user: User = Depends(get_current_user),
):
    """Send one user message: text, an image, a button (`chip`), or nothing to start a conversation.
    Leave `session_id` empty to start a new conversation."""
    if text and len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Message is longer than {MAX_TEXT_CHARS:,} characters.")
    # One extra byte so the check adapters can tell the image is over the limit.
    image_bytes = (await image.read(MAX_IMAGE_BYTES + 1)) if image is not None else None

    if session_id and chip != guided.CHIP_NEW_CHECK.id:
        session = _own_session(session_id, user)
    else:
        old = store.get(session_id, user.user_id) if session_id else None
        if old is not None:
            async with store.lock(old.session_id):
                old.cancel_tasks()
        session = store.create(user.user_id)

    async with store.lock(session.session_id):
        has_input = bool((text or "").strip() or image_bytes or (chip and chip != guided.CHIP_NEW_CHECK.id))
        if has_input:
            session.add_message("user", _user_message_text(text, image_bytes, chip))
            turn = await guided.handle(session, user, text=text, image=image_bytes, chip=chip)
        else:
            turn = guided.start(session)
        session.chips = turn.chips
        session.add_message("assistant", turn.reply)

        return MessageResponse(
            session_id=session.session_id,
            reply=turn.reply,
            chips=turn.chips,
            awaiting=session.awaiting,
            checks=session.case.as_list(),
            running=bool(session.case.running()),
            result=turn.result,
        )


@app.get("/assistant/session/{session_id}", response_model=SessionView)
async def get_session(session_id: str, user: User = Depends(get_current_user)):
    """The whole conversation. While `running` is true the app polls this every few seconds
    to pick up the background check's message and, if it was the last one, the result."""
    session = _own_session(session_id, user)
    return SessionView(
        session_id=session.session_id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        awaiting=session.awaiting,
        messages=session.messages,
        chips=session.chips,
        checks=session.case.as_list(),
        running=bool(session.case.running()),
        result=session.verdict,
    )
