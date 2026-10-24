# app/scope_rules.py
# Cheap text rules shared by the scope guard (LLM mode) and guided mode: does a message look like
# something to check (a job post, company or recruiter message), a greeting, or a question about
# the app? No LLM involved.

import re

from app.prompts import strip_wrapper_tags
from app.redact import redact

LONG_TEXT_CHARS = 200
GREETING_MAX_WORDS = 6

_GREETING = re.compile(
    r"^\W*(?:hi|hii+|hello|hey|hai|good\s+(?:morning|afternoon|evening|night)|thanks?|thank\s+you|thx|ty"
    r"|ok(?:ay)?|k|yes|yeah|yep|yup|no|nope|sure|alright|help|bye|goodbye|cool|great)\b",
    re.I,
)
_ABOUT_APP = re.compile(
    r"\b(?:fraudaware|privacy|private|my\s+data|personal\s+data|delete|feedback|who\s+are\s+you"
    r"|what\s+are\s+you|what\s+can\s+you\s+do|how\s+(?:does|do)\s+(?:this|it|you)\s+work)\b",
    re.I,
)
_CONTENT_WORDS = re.compile(
    r"\b(?:jobs?|vacanc\w*|hiring|hire[ds]?|recruit\w*|hr|interview\w*|salar\w*|wages?|pay|paid|payments?"
    r"|fees?|deposit\w*|earn\w*|income|part[\s-]?time|full[\s-]?time|work\s+from\s+home|online\s+work"
    r"|tasks?|commission\w*|invest\w*|offers?|selected|shortlisted|appointment|positions?|compan(?:y|ies)"
    r"|employers?|agency|agencies|pvt|ltd|plc|holdings|inc|website|e-?mail|whatsapp|telegram|viber|imo"
    r"|scam\w*|fraud\w*|fake|legit\w*|genuine|otp|bank|accounts?|visa|abroad|foreign|overseas|apply"
    r"|applied|cv|resume|registration|training|documents?|passport|nic|money|transfer\w*|refund\w*"
    r"|police|message[ds]?|chat|sms|call(?:ed)?|link|safe|risk\w*|warning|result|check\w*)\b",
    re.I,
)
_MONEY = re.compile(r"(?:\b(?:rs\.?|lkr|usd|rupees?)\s*\d|\$\s*\d|\d[\d,]*\s*(?:/-|rs\b|lkr\b|rupees\b))", re.I)
_LINK = re.compile(r"(?:https?://|www\.|\b[a-z0-9-]+\.(?:lk|com|net|org|info|biz|io|co|xyz|online|site)\b)", re.I)


def _clean(text: str) -> str:
    return strip_wrapper_tags(text).strip()


def looks_checkable(text: str) -> bool:
    """Long text, personal data, a link, money or job / company / payment / scam words."""
    text = _clean(text)
    if len(text) >= LONG_TEXT_CHARS or redact(text).total:
        return True
    return bool(_LINK.search(text) or _MONEY.search(text) or _CONTENT_WORDS.search(text))


_LEAVE_FOR_CHECK = re.compile(
    r"\b(?:check|verify|scam\w*|fraud\w*|fake|legit\w*|genuine|suspicious|warning)\b|https?://|www\.|@",
    re.I,
)
_PROFILE_Q = re.compile(
    r"\b(?:my\s+profile|my\s+skills|skills\s+do\s+i\s+have|what\s+(?:skills\s+)?do\s+i\s+have"
    r"|show\s+(?:me\s+)?my\s+(?:profile|skills)|what\s+is\s+on\s+my\s+profile)\b",
    re.I,
)
_SKILLS_Q = re.compile(r"\bskills?\b.{0,50}\b(?:need|needed|require\w*|for)\b", re.I)
_MATCH_Q = re.compile(
    r"\b(?:suits?\s+me|suitable(?:\s+for\s+me)?|jobs?\s+for\s+me|recommend\w*|which\s+jobs?"
    r"|match(?:es|ed|ing)?(?:\s+\w+){0,4}\s+me"
    r"|(?:jobs?|work)\s+match(?:es|ed|ing)?)\b",
    re.I,
)
_COMPANIES_Q = re.compile(
    r"\b(?:compan(?:y|ies)\s+(?:called|named|like|from)"
    r"|(?:what|which|list|show|give|tell).{0,40}\bcompan(?:y|ies)"
    r"|compan(?:y|ies)\s+(?:are|on|in|available|posted|hiring))\b",
    re.I,
)
_POSTED_Q = re.compile(
    r"\b(?:(?:all|posted|available|open|list(?:ed)?)\s+jobs?"
    r"|jobs?\s+(?:are\s+)?(?:posted|available|listed|open)"
    r"|show\s+(?:me\s+)?(?:all\s+|the\s+)?jobs?"
    r"|what\s+(?:are\s+)?(?:the\s+)?jobs)\b",
    re.I,
)
_ADD_PROFILE = re.compile(r"\badd\s+\w+.{0,40}\b(?:skill|profile|cv)\b", re.I)


def app_question(text: str) -> str | None:
    """A short question the app can answer from the profile or the posted jobs.

    Returns profile, skills, match, companies, posted_jobs, or None.
    A scam check, a link, or a pasted advert stays None so the three checks still run.
    """
    text = _clean(text)
    if not text or len(text.split()) > 40 or _LEAVE_FOR_CHECK.search(text):
        return None
    if _PROFILE_Q.search(text):
        return "profile"
    if _SKILLS_Q.search(text):
        return "skills"
    if _MATCH_Q.search(text):
        return "match"
    if _COMPANIES_Q.search(text):
        return "companies"
    if _POSTED_Q.search(text):
        return "posted_jobs"
    return None


def is_profile_request(text: str) -> bool:
    """A short question about the user's profile, posted jobs, or adding a skill."""
    text = _clean(text)
    if not text or len(text.split()) > 40:
        return False
    return app_question(text) is not None or bool(_ADD_PROFILE.search(text))


_HELLO_ONLY = re.compile(
    r"\W*(?:hi+|hello|hey|hai|good\s+(?:morning|afternoon|evening|night))\W*",
    re.I,
)


def is_hello(text: str) -> bool:
    """A greeting by itself, such as hi or good morning, with no other request."""
    return bool(_HELLO_ONLY.fullmatch(_clean(text)))


def is_small_talk(text: str) -> bool:
    """A short greeting or thanks, or a question about the app itself."""
    text = _clean(text)
    if _ABOUT_APP.search(text):
        return True
    return bool(_GREETING.match(text)) and len(text.split()) <= GREETING_MAX_WORDS
