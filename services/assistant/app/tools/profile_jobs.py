# app/tools/profile_jobs.py
# Extra assistant tools. They call user-management, job-management and job-recommendation.
# They do not run the scam, fake-job or employer checks, and they do not edit an uploaded CV file.

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.auth import User
from app.config import get_settings
from app.scope_rules import app_question
from app.sessions import Session
from app.tools.common import ServiceError

logger = logging.getLogger(__name__)

_SKILL = re.compile(r"[A-Za-z][A-Za-z0-9+.# ]{0,39}")
_ADD_SKILL = re.compile(
    r"\b(?:add|put|include|save)\s+([A-Za-z][A-Za-z0-9+.# ]{0,40}?)(?:\s+(?:to|on|in)\b|[.?!]?$)",
    re.I,
)
_JOB_TITLE = re.compile(
    r"\b(?:for|as|of)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+job)?\s*$",
    re.I,
)
_COMPANY_NAME = re.compile(r"\b(?:called|named|like|from)\s+(.+)$", re.I)
_LIST_LIMIT = 12
_COMPANY_STOP = {"pvt", "ltd", "plc", "limited", "private", "inc", "llc", "company", "the", "and", "co"}


def _norm_phrase(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9+.#]+", " ", (value or "").lower()).split())


def match_posted_job(jobs: List[Dict[str, Any]], text: str) -> Optional[Dict[str, Any]]:
    """The posted job whose title is inside the user's words. A named company picks that employer."""
    haystack = _norm_phrase(text)
    if len(haystack) < 2:
        return None
    short = len(haystack.split()) <= 6
    best: Optional[Dict[str, Any]] = None
    best_key = (-1, -1)
    for job in jobs:
        title = _norm_phrase(str(job.get("title") or ""))
        if len(title) < 3:
            continue
        if title not in haystack and not (short and haystack in title):
            continue
        company = _norm_phrase(str(job.get("companyName") or ""))
        company_hit = 0
        if company and company in haystack:
            company_hit = 2
        elif company:
            tokens = [word for word in company.split() if len(word) > 2 and word not in _COMPANY_STOP]
            words = haystack.split()
            if tokens and all(
                any(
                    word == token
                    or (len(token) >= 5 and len(word) >= 5 and (word.startswith(token) or token.startswith(word)))
                    for word in words
                )
                for token in tokens
            ):
                company_hit = 1
        key = (company_hit, len(title))
        if key > best_key:
            best_key = key
            best = job
    return best
_YES = re.compile(r"^(?:yes|yeah|yep|yup|ok|okay|sure|add it|confirm)\b", re.I)
_NO = re.compile(r"^(?:no|nope|don'?t|do not|cancel|stop|never)\b", re.I)


def confirmation(text: str) -> Optional[bool]:
    """True for yes, False for no, None when the message is not a short answer."""
    text = " ".join((text or "").split())
    if not text or len(text.split()) > 8:
        return None
    if _NO.match(text):
        return False
    if _YES.match(text):
        return True
    return None


def clean_skill(value: str) -> str:
    skill = " ".join((value or "").split())
    if not _SKILL.fullmatch(skill):
        raise ValueError("Ask for one skill name, such as Python.")
    return skill


def _headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _request(
    method: str,
    url: str,
    *,
    label: str,
    token: str,
    timeout: float,
    client: Optional[httpx.AsyncClient] = None,
    json_body: Any = None,
    params: Optional[Dict[str, Any]] = None,
) -> Any:
    try:
        if client is None:
            async with httpx.AsyncClient(timeout=timeout) as own:
                response = await own.request(method, url, headers=_headers(token), json=json_body, params=params)
        else:
            response = await client.request(
                method, url, headers=_headers(token), json=json_body, params=params, timeout=timeout
            )
    except httpx.TimeoutException:
        logger.warning("%s timed out: %s", label, url)
        raise ServiceError(f"The {label} took too long to answer.")
    except httpx.HTTPError as exc:
        logger.warning("%s unreachable: %s (%s)", label, url, type(exc).__name__)
        raise ServiceError(f"The {label} is not available right now.")

    if response.status_code >= 400:
        logger.warning("%s returned HTTP %s", label, response.status_code)
        raise ServiceError(f"The {label} is not available right now.", status=response.status_code)
    try:
        return response.json()
    except ValueError:
        raise ServiceError(f"The {label} returned an answer we could not read.")


async def profile_skills(user: User, client: Optional[httpx.AsyncClient] = None) -> Tuple[List[str], bool]:
    settings = get_settings()
    body = await _request(
        "GET",
        f"{settings.user_management_url}/api/profile/me",
        label="profile",
        token=user.token,
        timeout=15,
        client=client,
    )
    details = body.get("details") if isinstance(body, dict) else None
    if not isinstance(details, dict):
        raise ServiceError("The profile returned an answer we could not read.")
    skills = [str(item).strip() for item in details.get("skills") or [] if str(item).strip()]
    has_cv = bool(details.get("cvFiles"))
    return skills, has_cv


async def listed_jobs(user: User, client: Optional[httpx.AsyncClient] = None) -> List[Dict[str, Any]]:
    settings = get_settings()
    body = await _request(
        "GET",
        f"{settings.job_management_url}/api/jobs",
        label="job list",
        token=user.token,
        timeout=20,
        client=client,
        params={"sort": "newly_posted", "limit": 50},
    )
    jobs = body.get("jobs") if isinstance(body, dict) else None
    if not isinstance(jobs, list):
        raise ServiceError("The job list returned an answer we could not read.")
    return [job for job in jobs if isinstance(job, dict) and job.get("id") and job.get("title")]


def _live_job(job: Dict[str, Any]) -> Dict[str, Any]:
    risk = job.get("riskCheck") if isinstance(job.get("riskCheck"), dict) else {}
    return {
        "id": str(job["id"]),
        "title": str(job.get("title") or ""),
        "skills": [str(item) for item in job.get("skills") or [] if str(item).strip()],
        "isVerified": bool(job.get("isVerified")),
        "riskPrediction": risk.get("prediction") or "legitimate",
    }


async def rank_jobs(
    user: User, skills: List[str], jobs: List[Dict[str, Any]], client: Optional[httpx.AsyncClient] = None
) -> List[Dict[str, Any]]:
    if not skills or not jobs:
        return []
    settings = get_settings()
    body = await _request(
        "POST",
        f"{settings.job_recommendation_url}/recommend/live",
        label="job recommendation",
        token=user.token,
        timeout=30,
        client=client,
        json_body={"skills": skills, "jobs": [_live_job(job) for job in jobs], "limit": 5},
    )
    if not isinstance(body, list):
        raise ServiceError("The job recommendation returned an answer we could not read.")
    return [item for item in body if isinstance(item, dict)]


def _company(job: Dict[str, Any]) -> str:
    name = str(job.get("companyName") or "").strip()
    return name or "Company name not posted"


def _attach_companies(ranked: List[Dict[str, Any]], jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_id = {str(job.get("id")): job for job in jobs}
    by_title = {str(job.get("title") or "").lower(): job for job in jobs}
    attached = []
    for item in ranked[:5]:
        source = by_id.get(str(item.get("job_id") or "")) or by_title.get(str(item.get("job_title") or "").lower()) or {}
        attached.append(
            {
                "title": item.get("job_title") or "",
                "company": _company(source),
                "skills_you_have": item.get("skills_you_have") or [],
                "skills_to_develop": item.get("skills_to_develop") or [],
            }
        )
    return attached


def _gap(user_skills: List[str], job_skills: List[str]) -> Tuple[List[str], List[str]]:
    owned = {skill.lower() for skill in user_skills}
    have = [skill for skill in job_skills if skill.lower() in owned]
    missing = [skill for skill in job_skills if skill.lower() not in owned]
    return have, missing


async def suggest_jobs(user: User, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    skills, _has_cv = await profile_skills(user, client)
    if not skills:
        return {
            "needs_skills": True,
            "jobs": [],
            "note": "The profile has no skills. Ask the user to add skills on their profile before recommending jobs.",
        }
    jobs = await listed_jobs(user, client)
    if not jobs:
        return {"needs_skills": False, "jobs": [], "note": "No jobs are posted right now."}
    ranked = await rank_jobs(user, skills, jobs, client)
    return {"needs_skills": False, "jobs": _attach_companies(ranked, jobs)}


async def skills_for_job(user: User, title: str, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    wanted = " ".join((title or "").split()).lower()
    if len(wanted) < 2:
        raise ValueError("Ask which job title they mean.")
    skills, _has_cv = await profile_skills(user, client)
    jobs = await listed_jobs(user, client)
    match = match_posted_job(jobs, wanted)
    if match is None:
        return {
            "found": False,
            "note": "That job is not in the posted list.",
            "titles": [str(job.get("title")) for job in jobs[:5]],
        }
    job_skills = [str(item) for item in match.get("skills") or [] if str(item).strip()]
    have, missing = _gap(skills, job_skills)
    return {
        "found": True,
        "title": match.get("title"),
        "company": _company(match),
        "skills_you_have": have,
        "skills_to_develop": missing,
        "profile_has_skills": bool(skills),
    }


async def show_profile(user: User, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    skills, has_cv = await profile_skills(user, client)
    return {
        "skills": skills,
        "has_cv_file": has_cv,
        "note": "This is the profile skills list. The uploaded CV file is not edited here.",
    }


def propose_add_skill(session: Session, skill: str) -> Dict[str, Any]:
    cleaned = clean_skill(skill)
    session.pending_skill = cleaned
    return {
        "pending_skill": cleaned,
        "saved": False,
        "note": f"Ask the user to confirm before adding {cleaned}. Do not say it is saved yet.",
    }


async def save_pending_skill(session: Session, user: User, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
    skill = session.pending_skill
    if not skill:
        raise ValueError("There is no skill waiting to be saved.")
    current, _has_cv = await profile_skills(user, client)
    if any(item.lower() == skill.lower() for item in current):
        session.pending_skill = None
        return {"saved": False, "already_there": True, "skills": current, "skill": skill}
    updated = [*current, skill]
    settings = get_settings()
    await _request(
        "PUT",
        f"{settings.user_management_url}/api/profile/skills",
        label="profile",
        token=user.token,
        timeout=15,
        client=client,
        json_body={"skills": updated},
    )
    session.pending_skill = None
    return {
        "saved": True,
        "already_there": False,
        "skill": skill,
        "skills": updated,
        "note": "The profile skills list was updated. The uploaded CV file was not changed.",
    }


async def apply_confirmation(
    session: Session, user: User, agreed: bool, client: Optional[httpx.AsyncClient] = None
) -> str:
    skill = session.pending_skill or "that skill"
    if not agreed:
        session.pending_skill = None
        return f"Okay, I did not add {skill} to your profile."
    try:
        result = await save_pending_skill(session, user, client)
    except (ServiceError, ValueError) as exc:
        message = exc.message if isinstance(exc, ServiceError) else str(exc)
        return f"I could not update your profile: {message}"
    if result.get("already_there"):
        return f"{skill} is already on your profile."
    names = ", ".join(result.get("skills") or [])
    return (
        f"Added {skill} to your profile skills. Your uploaded CV file was not changed. "
        f"Your skills are now: {names}."
    )


def company_name_query(text: str) -> Optional[str]:
    match = _COMPANY_NAME.search(" ".join((text or "").split()))
    if not match:
        return None
    name = match.group(1).strip(" ?.!")
    if len(name) < 2:
        return None
    return name


def job_title_query(text: str) -> str:
    match = _JOB_TITLE.search(" ".join((text or "").split()))
    if not match:
        return ""
    return match.group(1).strip(" ?!.")


def _job_lines(jobs: List[Dict[str, Any]], limit: int = _LIST_LIMIT) -> List[str]:
    lines = []
    for job in jobs[:limit]:
        lines.append(f"- {job.get('title')} at {_company(job)}")
    extra = len(jobs) - len(lines)
    if extra > 0:
        lines.append(f"And {extra} more posted jobs.")
    return lines


async def list_companies(user: User, text: str, client: Optional[httpx.AsyncClient] = None) -> str:
    jobs = await listed_jobs(user, client)
    if not jobs:
        return "No jobs are posted right now, so there are no company names to show."
    query = company_name_query(text)
    chosen = jobs
    if query:
        needle = query.lower()
        chosen = [job for job in jobs if needle in _company(job).lower() or needle in str(job.get("title") or "").lower()]
        if not chosen:
            names = []
            for job in jobs:
                company = _company(job)
                if company not in names:
                    names.append(company)
            shown = ", ".join(names[:_LIST_LIMIT]) or "none"
            return f'No posted company matches "{query}". Companies on the list: {shown}.'
        return f'Posted jobs matching "{query}":\n' + "\n".join(_job_lines(chosen))
    lines = []
    seen = set()
    for job in jobs:
        company = _company(job)
        if company.lower() in seen:
            continue
        seen.add(company.lower())
        lines.append(f"- {company}: {job.get('title')}")
        if len(lines) >= _LIST_LIMIT:
            break
    return "Companies on posted jobs:\n" + "\n".join(lines)


async def list_posted_jobs(user: User, client: Optional[httpx.AsyncClient] = None) -> str:
    jobs = await listed_jobs(user, client)
    if not jobs:
        return "No jobs are posted right now."
    return "Posted jobs:\n" + "\n".join(_job_lines(jobs))


def skill_to_add(text: str) -> Optional[str]:
    match = _ADD_SKILL.search(text)
    if not match:
        return None
    try:
        return clean_skill(match.group(1))
    except ValueError:
        return None


def _profile_reply(result: Dict[str, Any]) -> str:
    skills = result["skills"]
    if not skills:
        return "Your profile has no skills yet. Tell me a skill to add, for example: add Python to my skills."
    cv = "A CV file is uploaded." if result["has_cv_file"] else "No CV file is uploaded."
    return f"Your profile skills are: {', '.join(skills)}. {cv} The uploaded CV file is not changed here."


def _skills_reply(result: Dict[str, Any]) -> str:
    if result.get("found") is False:
        titles = ", ".join(result.get("titles") or []) or "none"
        return f"I could not find that job in the posted list. Posted titles include: {titles}."
    have = ", ".join(result["skills_you_have"]) or "none"
    missing = ", ".join(result["skills_to_develop"]) or "none"
    extra = "" if result.get("profile_has_skills") else " Your profile has no skills yet."
    return (
        f"For {result['title']} at {result.get('company')}, you already have: {have}. "
        f"Skills to add: {missing}.{extra}"
    )


def _match_reply(result: Dict[str, Any]) -> str:
    if result.get("needs_skills"):
        return "Add skills to your profile first. Then I can match jobs from our list."
    jobs = result.get("jobs") or []
    if not jobs:
        return result.get("note") or "No matching jobs are posted right now."
    lines = []
    for item in jobs:
        missing = ", ".join(item.get("skills_to_develop") or []) or "none"
        lines.append(f"- {item.get('title')} at {item.get('company')} (skills to add: {missing})")
    return "Jobs that fit your profile skills:\n" + "\n".join(lines)


async def reply_to_text(session: Session, user: User, text: str, client: Optional[httpx.AsyncClient] = None) -> str:
    """Answer a profile or posted-job question from the real data, without a scam check."""
    try:
        skill = skill_to_add(text)
        if skill:
            propose_add_skill(session, skill)
            return f"Add {skill} to your profile skills? Your uploaded CV file will not be changed."
        kind = app_question(text)
        if kind == "profile":
            return _profile_reply(await show_profile(user, client))
        if kind == "skills":
            return _skills_reply(await skills_for_job(user, text, client))
        if kind == "companies":
            return await list_companies(user, text, client)
        if kind == "posted_jobs":
            return await list_posted_jobs(user, client)
        return _match_reply(await suggest_jobs(user, client))
    except ServiceError as exc:
        return exc.message
    except ValueError as exc:
        return str(exc)
