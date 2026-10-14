# app/agent.py
# LLM mode: Gemini talks to the user and decides which check to run; the code runs the checks
# and computes the final verdict. Everything sent to Gemini is masked first.
#
# If Gemini fails before any check ran, LlmUnavailable is raised and guided mode answers instead.
# If it fails after a check ran, the results are reported in guided mode's wording.

from typing import List

from app import agent_tools, guided
from app.auth import User
from app.llm import LlmClient, LlmUnavailable, Message, ToolResult
from app.prompts import system_prompt
from app.redact import redact
from app.schemas import ChatMessage, CheckResult
from app.sessions import Session
from app.verdict import CHECK_LABELS, combine

# Recent chat messages sent to Gemini (the older ones only cost tokens).
HISTORY_MESSAGES = 14
# Rounds of tool calls in one turn; the last round must answer in text.
MAX_ROUNDS = 5


def _render(index: int, message: ChatMessage) -> str:
    if message.role == "assistant":
        return redact(message.text).text
    if message.kind == "button":
        return f"(The user tapped the button: {message.text})"
    if message.kind == "image":
        return "(The user sent an image. The app checks images itself; you cannot see them.)"
    return f"[m{index}]\n<content_to_check>\n{redact(message.text).text}\n</content_to_check>"


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


async def handle(session: Session, user: User, client: LlmClient) -> guided.Turn:
    """Answer the user's latest message (already added to the session)."""
    finished = session.awaiting == "finished"
    tools = None if finished else agent_tools.TOOL_SPECS
    messages = history(session)
    ctx = agent_tools.ToolContext(session=session, user=user)
    reply = ""

    for round_no in range(MAX_ROUNDS):
        last_round = round_no == MAX_ROUNDS - 1
        try:
            answer = await client.generate(
                system_prompt(session.case, finished), messages, tools, force_text=last_round
            )
        except LlmUnavailable:
            if not ctx.results:
                raise
            return _fallback_reply(session, ctx.results)

        if not answer.tool_calls or tools is None or last_round:
            reply = answer.text
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
    if finished:
        return guided.Turn(reply, [guided.CHIP_NEW_CHECK])
    return _finish_turn(session, reply)
