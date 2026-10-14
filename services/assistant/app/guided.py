# app/guided.py
# Guided mode: the conversation driven by buttons and fixed wording, without an LLM.
# It is the first working version and later the fallback when Gemini is unavailable.
#
# Checks can be done in any order. After each check the assistant asks for the next missing
# one, even when the result looks fine, and shows the combined result when none is left.

from dataclasses import dataclass, field
from typing import List, Optional

from app.auth import User
from app.company_input import parse_company_details
from app.schemas import CheckResult, CheckSource, Chip, Verdict
from app.sessions import Session
from app.tools.company import check_company
from app.tools.job_post import check_job_post_image, check_job_post_text
from app.tools.recruiter_chat import check_recruiter_image, check_recruiter_text
from app.verdict import CHECK_LABELS, combine

# ─── BUTTONS ─────────────────────────────────────────────────────

CHIP_JOB_POST = Chip(id="check_job_post", label="Job post")
CHIP_COMPANY = Chip(id="check_company", label="Company")
CHIP_RECRUITER = Chip(id="check_recruiter", label="Recruiter messages")
CHIP_SKIP = Chip(id="skip", label="Skip")
CHIP_RECRUITER_YES = Chip(id="recruiter_yes", label="Yes, check their messages")
CHIP_RECRUITER_NO = Chip(id="recruiter_no", label="They haven't contacted me")
CHIP_IS_JOB_POST = Chip(id="is_job_post", label="It's a job post")
CHIP_IS_RECRUITER = Chip(id="is_recruiter", label="It's from the recruiter")
CHIP_IS_COMPANY = Chip(id="is_company", label="It's company details")
CHIP_NEW_CHECK = Chip(id="new_check", label="Start a new check")

_MENU_CHIP_FOR = {"job_post": CHIP_JOB_POST, "company": CHIP_COMPANY, "recruiter_chat": CHIP_RECRUITER}
_STAGE_FOR_CHIP = {
    CHIP_JOB_POST.id: "job_post",
    CHIP_COMPANY.id: "company",
    CHIP_RECRUITER.id: "recruiter_chat",
    CHIP_IS_JOB_POST.id: "job_post",
    CHIP_IS_COMPANY.id: "company",
    CHIP_IS_RECRUITER.id: "recruiter_chat",
}

# ─── WORDING ─────────────────────────────────────────────────────

GREETING = (
    "Hi! I'm the FraudAware Assistant. I can check a job post, the company and the "
    "recruiter's messages for signs of a scam. What would you like to check first? "
    "You can also just paste or send it to me."
)
PROMPTS = {
    "job_post": "Please paste the job post text or send a screenshot of it.",
    "company": (
        "Please send the company name, website or email address in one message "
        "(for example: ABC Holdings, www.abc.lk, hr@abc.lk)."
    ),
    "recruiter_question": (
        "Have you already chatted with the recruiter? Did they ask for money, documents, "
        "OTP codes or bank details?"
    ),
    "recruiter_chat": "Please paste the recruiter's messages or send a screenshot of the chat.",
}
RISK_HEADLINES = {
    "high": "shows strong warning signs",
    "medium": "shows some warning signs",
    "low": "shows no strong warning signs",
    "unknown": "could not be confirmed",
}
LOOKS_FINE_SO_FAR = (
    "That looks fine so far, but scammers often copy real companies and job posts, "
    "so let's check a bit more before you decide."
)
FINISHED_REPLY = "This check is finished. Tap \"Start a new check\" to check something else."


@dataclass
class Turn:
    reply: str
    chips: List[Chip] = field(default_factory=list)
    result: Optional[Verdict] = None


def _label(source: CheckSource) -> str:
    return CHECK_LABELS[source].lower()


def _menu_chips(session: Session) -> List[Chip]:
    return [_MENU_CHIP_FOR[s] for s in session.case.remaining()]


def describe(result: CheckResult) -> str:
    risk = result.risk or "unknown"
    lines = [f"{CHECK_LABELS[result.source]} check: {RISK_HEADLINES[risk]}."]
    lines += [f"- {reason}" for reason in result.reasons]
    return "\n".join(lines)


def start(session: Session) -> Turn:
    session.awaiting = "menu"
    return Turn(GREETING, _menu_chips(session))


def _ask(session: Session, source: CheckSource, intro: str = "") -> Turn:
    if source == "recruiter_chat" and session.awaiting != "recruiter_question":
        session.awaiting = "recruiter_question"
        return Turn(f"{intro}{PROMPTS['recruiter_question']}", [CHIP_RECRUITER_YES, CHIP_RECRUITER_NO, CHIP_SKIP])
    session.awaiting = source
    return Turn(f"{intro}{PROMPTS[source]}", [CHIP_SKIP])


def _advance(session: Session, prefix: str, last: Optional[CheckResult] = None) -> Turn:
    """Ask for the next missing check, or show the result when nothing is left."""
    remaining = session.case.remaining()
    if not remaining:
        session.awaiting = "finished"
        session.verdict = combine(session.case.as_list())
        return Turn(f"{prefix}\n\nThat's everything. Here is your result.".strip(), [CHIP_NEW_CHECK], session.verdict)

    intro = f"{prefix}\n\n" if prefix else ""
    if last is not None and last.risk == "low":
        intro += f"{LOOKS_FINE_SO_FAR}\n\n"
    nxt = remaining[0]
    if nxt != "recruiter_chat":
        intro += f"Next, let's check the {_label(nxt)}. "
    return _ask(session, nxt, intro)


async def _run_check(
    source: CheckSource, text: Optional[str], image: Optional[bytes], user: User
) -> Optional[CheckResult]:
    """Run the check for this content. None if the content type does not fit (e.g. a company image)."""
    if source == "job_post":
        return await (check_job_post_image(image) if image else check_job_post_text(text or ""))
    if source == "recruiter_chat":
        if image:
            return await check_recruiter_image(image, auth_token=user.token)
        return await check_recruiter_text(text or "", auth_token=user.token)
    if image:
        return None
    return await check_company(**parse_company_details(text or ""))


async def _check_and_advance(
    session: Session, source: CheckSource, text: Optional[str], image: Optional[bytes], user: User
) -> Turn:
    result = await _run_check(source, text, image, user)
    if result is None:
        session.awaiting = source
        return Turn("I can't read company details from an image. " + PROMPTS["company"], [CHIP_SKIP])

    session.case.set(result)
    if result.status == "failed":
        session.awaiting = source
        reason = result.reasons[0] if result.reasons else "Something went wrong."
        return Turn(f"I couldn't complete the {_label(source)} check: {reason} You can try again or tap Skip.", [CHIP_SKIP])
    return _advance(session, describe(result), last=result)


async def handle(
    session: Session,
    user: User,
    *,
    text: Optional[str] = None,
    image: Optional[bytes] = None,
    chip: Optional[str] = None,
) -> Turn:
    text = (text or "").strip() or None
    has_content = bool(text or image)
    stage = session.awaiting

    if stage == "finished":
        return Turn(FINISHED_REPLY, [CHIP_NEW_CHECK], session.verdict)

    if chip == CHIP_SKIP.id and stage in ("job_post", "company", "recruiter_question", "recruiter_chat"):
        source = "recruiter_chat" if stage == "recruiter_question" else stage
        session.case.mark(source, "skipped")
        return _advance(session, f"Okay, I skipped the {_label(source)} check.")

    if stage == "menu":
        if chip in (CHIP_JOB_POST.id, CHIP_COMPANY.id, CHIP_RECRUITER.id):
            session.awaiting = _STAGE_FOR_CHIP[chip]
            return Turn(PROMPTS[session.awaiting], [CHIP_SKIP])
        if has_content:
            session._pending_text, session._pending_image = text, image
            session.awaiting = "input_type"
            chips = [CHIP_IS_JOB_POST, CHIP_IS_RECRUITER] + ([] if image else [CHIP_IS_COMPANY])
            return Turn("Thanks! What did you send me?", chips)
        return Turn("Please choose what you would like to check, or paste it here.", _menu_chips(session))

    if stage == "input_type":
        if chip in (CHIP_IS_JOB_POST.id, CHIP_IS_RECRUITER.id, CHIP_IS_COMPANY.id):
            pending_text, pending_image = session._pending_text, session._pending_image
            session._pending_text = session._pending_image = None
            return await _check_and_advance(session, _STAGE_FOR_CHIP[chip], pending_text, pending_image, user)
        if has_content:
            session._pending_text, session._pending_image = text, image
        chips = [CHIP_IS_JOB_POST, CHIP_IS_RECRUITER] + ([] if session._pending_image else [CHIP_IS_COMPANY])
        return Turn("Please tell me what you sent so I can run the right check.", chips)

    if stage == "recruiter_question":
        if chip == CHIP_RECRUITER_NO.id:
            session.case.mark("recruiter_chat", "not_applicable")
            return _advance(session, "Okay, good. If a recruiter contacts you later, you can check their messages here.")
        if has_content:
            return await _check_and_advance(session, "recruiter_chat", text, image, user)
        if chip == CHIP_RECRUITER_YES.id:
            return _ask(session, "recruiter_chat")
        return Turn(PROMPTS["recruiter_question"], [CHIP_RECRUITER_YES, CHIP_RECRUITER_NO, CHIP_SKIP])

    # Waiting for the content of one check.
    if has_content:
        return await _check_and_advance(session, stage, text, image, user)
    return Turn(PROMPTS[stage], [CHIP_SKIP])
