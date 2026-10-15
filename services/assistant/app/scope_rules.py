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


def is_small_talk(text: str) -> bool:
    """A short greeting or thanks, or a question about the app itself."""
    text = _clean(text)
    if _ABOUT_APP.search(text):
        return True
    return bool(_GREETING.match(text)) and len(text.split()) <= GREETING_MAX_WORDS
