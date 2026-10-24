# app/agent_tools.py
# The tools the LLM can call. The LLM only sees masked text, so it never passes content itself:
# it names a user message ("m3") and the check runs on that message's original text.
# Every result goes back to the LLM in a short, masked summary.

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app import background, guided
from app.auth import User
from app.company_input import parse_company_details
from app.llm import ToolCall, ToolSpec
from app.prompts import untrusted
from app.schemas import CheckResult, CheckSource
from app.sessions import Session
from app.tools import profile_jobs
from app.tools.common import ServiceError
from app.verdict import CHECK_LABELS

_MESSAGE_ID = {"type": "string", "description": "Id of the user message with the content, e.g. \"m3\"."}

TOOL_SPECS = [
    ToolSpec(
        name="check_job_post",
        description="Check a job advert / vacancy post that the user pasted for signs of a fake job.",
        parameters={"type": "object", "properties": {"message_id": _MESSAGE_ID}, "required": ["message_id"]},
    ),
    ToolSpec(
        name="check_recruiter_messages",
        description=(
            "Check messages the recruiter or employer sent the user (chat, SMS, email) for scam tactics "
            "such as fees, urgency or requests for documents, OTP codes or bank details."
        ),
        parameters={"type": "object", "properties": {"message_id": _MESSAGE_ID}, "required": ["message_id"]},
    ),
    ToolSpec(
        name="check_company",
        description=(
            "Verify the employer using its name, website and/or email from a user message. Runs in the "
            "background for up to 90 seconds; the result is posted to the chat automatically."
        ),
        parameters={
            "type": "object",
            "properties": {
                "message_id": _MESSAGE_ID,
                "company_name": {"type": "string", "description": "Company name as written in the message."},
                "website": {"type": "string", "description": "Company website as written in the message."},
                "email": {"type": "string", "description": "Email exactly as shown, e.g. [EMAIL]@abc.lk."},
            },
            "required": ["message_id"],
        },
    ),
    ToolSpec(
        name="update_check",
        description=(
            "Record that a check will not be done: 'skipped' when the user does not want it, "
            "'not_applicable' (recruiter_messages only) when no recruiter has contacted the user."
        ),
        parameters={
            "type": "object",
            "properties": {
                "check": {"type": "string", "enum": ["job_post", "company", "recruiter_messages"]},
                "status": {"type": "string", "enum": ["skipped", "not_applicable"]},
            },
            "required": ["check", "status"],
        },
    ),
]

PROFILE_TOOL_SPECS = [
    ToolSpec(
        name="suggest_jobs",
        description=(
            "List posted FraudAware jobs that match the logged-in user's profile skills. "
            "Call this when they ask which job suits them. Does not run a scam check."
        ),
        parameters={"type": "object", "properties": {}},
    ),
    ToolSpec(
        name="skills_for_job",
        description=(
            "Compare the user's profile skills with one posted job. Pass the job title and company "
            "in the user's own words. The app matches a real posted job. Does not run a scam check."
        ),
        parameters={
            "type": "object",
            "properties": {
                "job_title": {"type": "string", "description": "Job title as the user said it."},
                "company_name": {"type": "string", "description": "Company name as the user said it, if any."},
            },
            "required": ["job_title"],
        },
    ),
    ToolSpec(
        name="show_profile",
        description="Read the logged-in user's profile skills. Does not change the profile or the CV file.",
        parameters={"type": "object", "properties": {}},
    ),
    ToolSpec(
        name="propose_add_skill",
        description=(
            "Ask to add one skill to the profile. This does not save. The app saves only after the user says yes."
        ),
        parameters={
            "type": "object",
            "properties": {"skill": {"type": "string", "description": "One skill name, such as Python."}},
            "required": ["skill"],
        },
    ),
]

TOOL_SPECS = [*TOOL_SPECS, *PROFILE_TOOL_SPECS]

_SOURCE_FOR_CHECK = {"job_post": "job_post", "company": "company", "recruiter_messages": "recruiter_chat"}
_EMAIL = re.compile(r"[\w.+-]+@([\w-]+(?:\.[\w-]+)+)")


class ToolError(Exception):
    """A bad tool call; the message goes back to the LLM so it can correct itself or ask the user."""


@dataclass
class ToolContext:
    session: Session
    user: User
    # Check results produced in this turn, for the fallback reply if the LLM fails afterwards.
    results: List[CheckResult] = field(default_factory=list)


def _label(source: CheckSource) -> str:
    return CHECK_LABELS[source]


def _latest_user_text(session: Session) -> str:
    for message in reversed(session.messages):
        if message.role == "user" and message.kind == "text":
            return message.text or ""
    return ""


def _original_text(session: Session, message_id: Any) -> str:
    match = re.fullmatch(r"\[?m?(\d+)\]?", str(message_id or "").strip(), re.I)
    index = int(match.group(1)) if match else -1
    if not 0 <= index < len(session.messages):
        raise ToolError(f"There is no message {message_id}. Use the id shown before the user's message.")
    message = session.messages[index]
    if message.role != "user" or message.kind != "text":
        raise ToolError(f"Message {message_id} is not text the user typed or pasted.")
    return message.text


def _norm(value: str) -> str:
    value = re.sub(r"^\s*(?:https?://)?(?:www\.)?", "", value.lower())
    return " ".join(value.rstrip("/ ").split())


def _company_details(original: str, args: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """The details the LLM read from the message, kept only if they really are in it."""
    text = " ".join(original.lower().split())
    details: Dict[str, Optional[str]] = {"company_name": None, "website_url": None, "email": None}

    for key, arg in (("company_name", "company_name"), ("website_url", "website")):
        value = str(args.get(arg) or "").strip()
        if value and _norm(value) in text:
            details[key] = value

    email = str(args.get("email") or "").strip()
    if email:
        domain = email.rsplit("@", 1)[-1].lower()
        details["email"] = next((m.group(0) for m in _EMAIL.finditer(original) if m.group(1).lower() == domain), None)

    if not any(details.values()):
        details = parse_company_details(original)
    if not any(details.values()):
        raise ToolError("No company name, website or email found in that message. Ask the user for them.")
    return details


def summary(session: Session, result: CheckResult) -> Dict[str, Any]:
    case = session.case
    summary: Dict[str, Any] = {"check": _label(result.source), "status": result.status}
    if result.status == "done":
        summary["risk"] = result.risk or "unknown"
        summary["warning_signs"] = [untrusted(r) for r in result.reasons]
    elif result.status == "failed":
        summary["problem"] = untrusted(result.reasons[0]) if result.reasons else "The check is not available."
    elif result.status == "running":
        summary["note"] = "Takes up to 90 seconds. The result is posted to the chat automatically."
    summary["checks_still_needed"] = [_label(s) for s in case.to_ask()]
    summary["checks_running"] = [_label(s) for s in case.running()]
    summary["all_checks_finished"] = case.is_complete()
    return summary


async def _check_content(ctx: ToolContext, source: CheckSource, args: Dict[str, Any]) -> CheckResult:
    text = _original_text(ctx.session, args.get("message_id"))
    result = await guided.run_check(source, text, None, ctx.user)
    ctx.session.case.set(result)
    return result


def _start_company(ctx: ToolContext, args: Dict[str, Any]) -> CheckResult:
    details = _company_details(_original_text(ctx.session, args.get("message_id")), args)
    guided.start_company_background(ctx.session, details)
    return ctx.session.case.get("company")


def _update_check(ctx: ToolContext, args: Dict[str, Any]) -> CheckResult:
    source = _SOURCE_FOR_CHECK.get(str(args.get("check")))
    status = args.get("status")
    if source is None or status not in ("skipped", "not_applicable"):
        raise ToolError("check must be job_post, company or recruiter_messages; status skipped or not_applicable.")
    if status == "not_applicable" and source != "recruiter_chat":
        raise ToolError("not_applicable is only for recruiter_messages. Use skipped.")
    if ctx.session.case.get(source).status == "done":
        raise ToolError(f"The {_label(source).lower()} check is already done.")
    background.cancel(ctx.session, source)
    ctx.session.case.mark(source, status)
    return ctx.session.case.get(source)


async def _profile_tool(call: ToolCall, ctx: ToolContext) -> Dict[str, Any]:
    args = call.args or {}
    try:
        if call.name == "suggest_jobs":
            return await profile_jobs.suggest_jobs(ctx.user)
        if call.name == "skills_for_job":
            spoken = _latest_user_text(ctx.session)
            hint = " ".join(
                part.strip()
                for part in (str(args.get("job_title") or ""), str(args.get("company_name") or ""), spoken)
                if part and str(part).strip()
            )
            return await profile_jobs.skills_for_job(ctx.user, hint)
        if call.name == "show_profile":
            return await profile_jobs.show_profile(ctx.user)
        if call.name == "propose_add_skill":
            return profile_jobs.propose_add_skill(ctx.session, str(args.get("skill") or ""))
    except ServiceError as exc:
        return {"error": exc.message}
    except ValueError as exc:
        raise ToolError(str(exc))
    raise ToolError(f"Unknown tool {call.name}.")


async def run(call: ToolCall, ctx: ToolContext) -> Tuple[Dict[str, Any], Optional[CheckResult]]:
    """Run one tool call: (response for the LLM, the check's new state or None if the call was bad)."""
    args = call.args or {}
    if call.name in {spec.name for spec in PROFILE_TOOL_SPECS}:
        try:
            return await _profile_tool(call, ctx), None
        except ToolError as exc:
            return {"error": str(exc)}, None
    try:
        if call.name == "check_job_post":
            result = await _check_content(ctx, "job_post", args)
        elif call.name == "check_recruiter_messages":
            result = await _check_content(ctx, "recruiter_chat", args)
        elif call.name == "check_company":
            result = _start_company(ctx, args)
        elif call.name == "update_check":
            result = _update_check(ctx, args)
        else:
            raise ToolError(f"Unknown tool {call.name}.")
    except ToolError as e:
        return {"error": str(e)}, None
    ctx.results.append(result)
    return summary(ctx.session, result), result
