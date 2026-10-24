# app/main.py

import asyncio
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import agent, guard, guided, llm, rate_limit
from app.auth import User, get_current_user
from app.config import get_settings
from app.schemas import HealthResponse, MessageResponse, SessionView
from app.sessions import Session, store
from app.scope_rules import is_hello, is_profile_request
from app.tools import profile_jobs
from app.tools.common import MAX_IMAGE_BYTES

MAX_TEXT_CHARS = 10_000

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # In the background: the server starts even when MongoDB is slow or unreachable.
    connecting = asyncio.create_task(store.connect())
    yield
    connecting.cancel()


app = FastAPI(
    title="FraudAware Assistant API",
    description="Conversational job-scam checker built on the FraudAware detection services",
    version="0.1.0",
    lifespan=lifespan,
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


def _message_kind(image: Optional[bytes], chip: Optional[str]) -> str:
    return "button" if chip else "image" if image else "text"


async def _reply(session: Session, user: User, text: Optional[str], image: Optional[bytes], chip: Optional[str]):
    """Typed text goes to the LLM when it is configured, after the scope guard. Buttons, images and
    answers to "what did you send?" go to guided mode, which runs the checks; the LLM then explains
    any result. Guided mode's own reply is used whenever the LLM fails."""
    if not chip and not image and is_hello(text or ""):
        return guided.Turn(guided.AGENT_HELLO, session.chips or guided.menu_chips(session))

    if not chip and not image:
        skill = profile_jobs.skill_to_add(text or "")
        if skill:
            profile_jobs.propose_add_skill(session, skill)
            reply = (
                f"Add {skill} to your profile skills? Reply yes to save it. "
                "The uploaded CV file will not change."
            )
            return guided.Turn(reply, session.chips or guided.menu_chips(session))

    if not chip and not image and session.pending_skill:
        decision = profile_jobs.confirmation(text or "")
        if decision is not None:
            reply = await profile_jobs.apply_confirmation(session, user, decision)
            return guided.Turn(reply, session.chips or guided.menu_chips(session))
        if is_profile_request(text or ""):
            session.pending_skill = None

    client = llm.get_client()
    if client is not None:
        client = rate_limit.LimitedClient(client, user.user_id)
    if client is not None and not chip and not image and session.awaiting == "input_type":
        # A typed answer ("it's the job post") or a waiting image stays with guided mode, which
        # runs the check. Anything else: the LLM takes over; it can still check waiting text by id.
        if guided.answered_type(session, text) is None and session._pending_image is None:
            session._pending_text = None
            session.awaiting = "menu"
    if client is not None and not chip and not image and session.awaiting != "input_type":
        try:
            if not await guard.in_scope(client, text or "", session):
                return guard.out_of_scope_turn(session)
            return await agent.handle(session, user, client)
        except llm.LlmUnavailable:
            client = None

    before = {c.source: c for c in session.case.as_list()}
    turn = await guided.handle(session, user, text=text, image=image, chip=chip)
    checked = [c for c in session.case.as_list() if c.status in ("done", "failed") and c is not before[c.source]]
    if client is not None and checked:
        try:
            return await agent.handle(session, user, client, checked=checked)
        except llm.LlmUnavailable:
            pass
    return turn


async def _own_session(session_id: str, user: User) -> Session:
    session = await store.get(session_id, user.user_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return session


def _check_message_limit(user: User) -> None:
    refused = rate_limit.limits.message_refused(user.user_id)
    if refused is not None:
        raise HTTPException(status_code=429, detail=refused, headers={"Retry-After": "60"})


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
        "session_store": store.kind,
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
    _check_message_limit(user)
    if text and len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Message is longer than {MAX_TEXT_CHARS:,} characters.")
    # One extra byte so the check adapters can tell the image is over the limit.
    image_bytes = (await image.read(MAX_IMAGE_BYTES + 1)) if image is not None else None

    if session_id and chip != guided.CHIP_NEW_CHECK.id:
        session = await _own_session(session_id, user)
    else:
        old = await store.get(session_id, user.user_id) if session_id else None
        if old is not None:
            async with store.lock(old.session_id):
                old.cancel_tasks()
                await store.save(old)
        session = store.create(user.user_id)

    async with store.lock(session.session_id):
        # Told in this reply, so the app does not have to look for an extra message.
        notes = guided.recover_interrupted(session)
        has_input = bool((text or "").strip() or image_bytes or (chip and chip != guided.CHIP_NEW_CHECK.id))
        if has_input:
            session.add_message("user", _user_message_text(text, image_bytes, chip), _message_kind(image_bytes, chip))
            turn = await _reply(session, user, text, image_bytes, chip)
        else:
            turn = guided.start(session)
        reply = "\n\n".join([*notes, turn.reply])
        session.chips = turn.chips
        session.add_message("assistant", reply)
        await store.save(session)

        return MessageResponse(
            session_id=session.session_id,
            reply=reply,
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
    session = await _own_session(session_id, user)
    async with store.lock(session.session_id):
        notes = guided.recover_interrupted(session)
        if notes:
            for note in notes:
                session.add_message("assistant", note)
            await store.save(session)
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
