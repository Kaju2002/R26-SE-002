# app/message_validation.py
# Stop unrelated text and photos (a caption, a greeting, a picture with no chat) from
# reaching the scam model. A message must be long enough and look like a recruiter chat.

import re
from typing import Optional

MIN_CHARS = 40
MIN_WORDS = 8

NOT_A_MESSAGE = (
    "This does not look like a recruiter message. "
    "Please paste the chat, or send a clear screenshot of it."
)

_CONTENT = re.compile(
    r"\b(?:jobs?|vacanc\w*|hiring|hire[ds]?|recruit\w*|hr|interview\w*|salar\w*|wages?|pay|paid|payments?"
    r"|fees?|deposit\w*|earn\w*|income|part[\s-]?time|full[\s-]?time|work\s+from\s+home"
    r"|commission\w*|offers?|selected|shortlisted|appointment|positions?|compan(?:y|ies)"
    r"|employers?|whatsapp|telegram|viber|sms|otp|bank|accounts?|visa|abroad|overseas|apply"
    r"|cv|resume|registration|training|documents?|passport|nic|money|transfer\w*|refund\w*)\b",
    re.I,
)
_MONEY = re.compile(r"(?:\b(?:rs\.?|lkr|usd|rupees?)\s*\d|\$\s*\d|\d[\d,]*\s*(?:/-|rs\b|lkr\b|rupees\b))", re.I)
_LINK = re.compile(r"(?:https?://|www\.|\b[a-z0-9-]+\.(?:lk|com|net|org|info|biz|io|co|xyz|online|site)\b)", re.I)


def rejection_reason(text: str) -> Optional[str]:
    """A user-facing reason to refuse `text`, or None when it may be sent to the model."""
    text = (text or "").strip()
    if len(text) < MIN_CHARS or len(text.split()) < MIN_WORDS:
        return NOT_A_MESSAGE
    if not (_CONTENT.search(text) or _MONEY.search(text) or _LINK.search(text)):
        return NOT_A_MESSAGE
    return None
