# app/agent.py
# LLM mode: Gemini talks to the user and decides which check to run; the code runs the checks
# and computes the final verdict. Everything sent to Gemini is masked first, and images never
# reach it: the code checks screenshots and Gemini only explains the results.
#
# If Gemini fails before any check ran, LlmUnavailable is raised and guided mode answers instead.
# If it fails after a check ran, the results are reported in guided mode's wording.
# A reply that contradicts the check results is replaced with code wording (reply_check.py).

import json
import logging
import re
from typing import List, Sequence

from app import agent_tools, guided, reply_check
from app.auth import User
from app.llm import LlmClient, LlmUnavailable, Message, ToolResult
from app.prompts import system_prompt, untrusted
from app.schemas import ChatMessage, CheckResult
from app.scope_rules import app_question
from app.sessions import Session
from app.tools import profile_jobs
from app.verdict import CHECK_LABELS, combine

logger = logging.getLogger(__name__)

# Recent chat messages sent to Gemini (the older ones only cost tokens).
HISTORY_MESSAGES = 14
# Rounds of tool calls in one turn; the last round must answer in text.
MAX_ROUNDS = 5

_BOLD = re.compile(r"\*\*(.+?)\*\*|__(.+?)__", re.S)
_HEADING = re.compile(r"^#{1,6}\s+", re.M)


def _plain(text: str) -> str:
    """The app shows plain text, so markdown bold and heading marks would show as symbols."""
    text = _BOLD.sub(lambda m: m.group(1) or m.group(2), text or "")
    return _HEADING.sub("", text).strip()


def _render(index: int, message: ChatMessage) -> str:
    if message.role == "assistant":
        # Can quote check results, which quote websites and messages.
        return untrusted(message.text)
    if message.kind == "button":
        return f"(The user tapped the button: {message.text})"
    if message.kind == "image":
        return "(The user sent an image. The app checks images itself; you cannot see them.)"
    return f"[m{index}]\n<user_message>\n{untrusted(message.text)}\n</user_message>"


def history(session: Session) -> List[Message]:
    """The recent chat as Gemini messages: masked, starting with the user, roles alternating."""
    recent = list(enumerate(session.messages))[-HISTORY_MESSAGES:]
    while recent and recent[0][1].role == "assistant":
        recent.pop(0)
    messages: List[Message] = []
    for index, message in recent:
        role = "user" if message.role == "user" else "model"
        text = _render(index, message)
        if messages and messages[-1].role == role:
            messages[-1].text += f"\n\n{text}"
        else:
            messages.append(Message(role=role, text=text))
    return messages


def _checked_note(session: Session, checked: Sequence[CheckResult]) -> str:
    results = [agent_tools.summary(session, r) for r in checked]
    return (
        "(The app already ran these checks on what the user sent. Explain the results to the user:)\n"
        + json.dumps(results, ensure_ascii=False)
    )


def _fallback_reply(session: Session, results: List[CheckResult]) -> guided.Turn:
    """Gemini failed after running checks: report them in guided mode's wording."""
    parts = []
    for result in results:
        label = CHECK_LABELS[result.source].lower()
        if result.status == "done":
            parts.append(guided.describe(result))
        elif result.status == "running":
            parts.append(guided.CHECKING_COMPANY)
        elif result.status == "failed":
            reason = result.reasons[0] if result.reasons else "Something went wrong."
            parts.append(f"I couldn't complete the {label} check: {reason}")
        else:
            parts.append(f"Okay, I noted the {label} check as not needed.")
    last_done = next((r for r in reversed(results) if r.status == "done"), None)
    return guided.advance(session, "\n\n".join(parts), last=last_done)


def _code_reply(session: Session, results: Sequence[CheckResult]) -> str:
    """Replaces a Gemini reply that contradicted the results; the state is already final."""
    case = session.case
    parts = [guided.describe(r) for r in results if r.status == "done"]
    to_ask = case.to_ask()
    if session.verdict is not None and case.is_complete():
        parts.append(f"Your result: {session.verdict.title}. Please read the result card before you decide.")
    elif to_ask:
        nxt = to_ask[0]
        prompt = guided.PROMPTS["recruiter_question" if nxt == "recruiter_chat" else nxt]
        parts.append(f"Next, let's check the {CHECK_LABELS[nxt].lower()}. {prompt}")
    elif case.running():
        parts.append(guided.still_checking(session))
    return "\n\n".join(parts)


def _latest_user_text(session: Session) -> str:
    for message in reversed(session.messages):
        if message.role == "user" and message.kind == "text":
            return message.text or ""
    return ""


def _keeps_model_wording(reply: str, factual: str) -> bool:
    """True when the model repeated the posted title and company, instead of asking for a scam check."""
    low = (reply or "").lower()
    if "paste the job post" in low or "i can only help" in low:
        return False
    named = re.search(r"for (.+?) at (.+?),", factual or "", re.I)
    if named:
        return named.group(1).lower() in low and named.group(2).lower() in low
    lines = [line[2:].split("(skills")[0].strip().lower() for line in factual.splitlines() if line.startswith("- ")]
    if lines:
        return any(line and line in low for line in lines[:3])
    if "profile skills are" in (factual or "").lower():
        return "skill" in low
    return False


def _finish_turn(session: Session, reply: str) -> guided.Turn:
    case = session.case
    if case.is_complete():
        session.awaiting = "finished"
        session.verdict = combine(case.as_list())
        return guided.Turn(reply, [guided.CHIP_NEW_CHECK], session.verdict)
    if case.running() and not case.to_ask():
        session.awaiting = "waiting"
        return guided.Turn(reply, [guided.CHIP_SKIP])
    session.awaiting = "menu"
    return guided.Turn(reply, guided.menu_chips(session))


async def handle(
    session: Session, user: User, client: LlmClient, checked: Sequence[CheckResult] = ()
) -> guided.Turn:
    """Answer the user's latest message (already added to the session). `checked` are checks
    the code already ran on that message (a screenshot or a button) for Gemini to explain."""
    # The result card was shown earlier; this is a question about it.
    after_result = session.awaiting == "finished" and not checked
    latest = _latest_user_text(session)
    # A posted-job or profile question is not a scam check, so the check tools stay hidden.
    kind = None if checked else app_question(latest)
    if kind:
        tools = agent_tools.PROFILE_TOOL_SPECS
    elif session.case.is_complete() and checked:
        tools = None
    elif session.case.is_complete():
        tools = agent_tools.PROFILE_TOOL_SPECS
    else:
        tools = agent_tools.TOOL_SPECS
    prompt = system_prompt(session.case)
    if kind:
        prompt += (
            "This message asks about posted jobs or the user's profile. "
            "Answer from the profile tools only. Do not ask the user to paste a job post.\n"
        )
    messages = history(session)
    if checked:
        messages[-1].text += f"\n\n{_checked_note(session, checked)}"
    ctx = agent_tools.ToolContext(session=session, user=user)
    reply = ""

    for round_no in range(MAX_ROUNDS):
        # A turn that just finished the scam checks only explains that result.
        force_text = round_no == MAX_ROUNDS - 1 or tools is None
        try:
            answer = await client.generate(prompt, messages, tools, force_text=force_text)
        except LlmUnavailable:
            if not ctx.results:
                raise
            return _fallback_reply(session, ctx.results)

        if not answer.tool_calls or tools is None or force_text:
            reply = _plain(answer.text)
            break

        messages.append(Message(role="model", text=answer.text, tool_calls=answer.tool_calls, raw=answer.raw))
        tool_results = []
        for call in answer.tool_calls:
            response, _ = await agent_tools.run(call, ctx)
            tool_results.append(ToolResult(name=call.name, response=response, id=call.id))
        messages.append(Message(role="user", tool_results=tool_results))

    if not reply:
        if not ctx.results:
            raise LlmUnavailable("no reply")
        return _fallback_reply(session, ctx.results)

    if kind:
        factual = await profile_jobs.reply_to_text(session, user, latest)
        if not _keeps_model_wording(reply, factual):
            reply = factual
    turn = guided.Turn(reply, [guided.CHIP_NEW_CHECK]) if after_result else _finish_turn(session, reply)
    if kind:
        return turn
    if reply_check.contradicts(turn.reply, session.case, session.verdict):
        logger.warning("Gemini reply replaced: it contradicted the check results")
        turn.reply = _code_reply(session, [*checked, *ctx.results])
    return turn
