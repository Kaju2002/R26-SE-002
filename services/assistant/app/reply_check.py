# app/reply_check.py
# Post-LLM check: the reply must not contradict the checks. Saying the offer is safe while a
# check found warning signs (or before anything was checked), or calling it a scam when no
# check found any, makes the agent replace the reply with code wording.
#
# Only claims about the job or offer as a whole count; "the company check found no warning
# signs" is a fair per-check sentence.

import re
from typing import Optional

from app.case_state import CaseState
from app.schemas import Verdict

_SUBJECT = (
    r"\b(?:it|this|that|everything"
    r"|(?:the|this|your)\s+(?:job(?:\s+(?:offer|post|advert))?|offer|opportunity|vacancy|position))"
)
_VERB = r"(?:\s+is|['’]s|\s+looks|\s+seems|\s+appears|\s+sounds)(?:\s+to\s+be)?"
_ADVERB = (
    r"(?:\s+(?:definitely|clearly|probably|likely|most\s+likely|almost\s+certainly"
    r"|completely|totally|very|quite|perfectly|100%))?"
)

_SAFE_CLAIMS = [
    re.compile(_SUBJECT + _VERB + _ADVERB + r"\s+(?:safe|legit(?:imate)?|genuine|trustworthy|real)\b", re.I),
    re.compile(r"\bsafe\s+to\s+(?:apply|pay|proceed|join|accept|continue|go\s+ahead|trust)\b", re.I),
    re.compile(r"\bnot\s+an?\s+(?:scam|fake|fraud)\b", re.I),
    re.compile(r"\b(?:nothing|no\s+need)\s+to\s+worry\b", re.I),
]
_SCAM_CLAIMS = [
    re.compile(_SUBJECT + _VERB + _ADVERB + r"\s+(?:an?\s+)?(?:scam|fake|fraud(?:ulent)?|high[\s-]risk)\b", re.I),
]
_NEGATED = re.compile(r"(?:\bnot|n['’]t|\bnever)\W+(?:\w+\W+){0,2}$", re.I)


def _claims(text: str, patterns) -> bool:
    for pattern in patterns:
        for match in pattern.finditer(text):
            if not _NEGATED.search(text[: match.start()]):
                return True
    return False


def warning_found(case: CaseState, verdict: Optional[Verdict]) -> bool:
    if verdict is not None:
        return verdict.level in ("high_risk", "be_careful")
    return any(c.status == "done" and c.risk in ("high", "medium") for c in case.as_list())


def contradicts(reply: str, case: CaseState, verdict: Optional[Verdict]) -> bool:
    """True if the reply calls the offer safe despite warning signs (or before any check),
    or calls it a scam when no check found warning signs."""
    warning = warning_found(case, verdict)
    if warning or not any(c.status == "done" for c in case.as_list()):
        if _claims(reply, _SAFE_CLAIMS):
            return True
    if not warning and _claims(reply, _SCAM_CLAIMS):
        return True
    return False
