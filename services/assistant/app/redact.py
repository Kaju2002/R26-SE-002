# app/redact.py
# Hide personal data before any text is sent to the LLM (Gemini). The detection models
# still receive the original text, so their accuracy is not affected.
#
#   phone numbers            -> [PHONE]
#   email addresses          -> [EMAIL]@domain   (the domain is a scam signal, e.g. @gmail.com)
#   NIC numbers              -> [NIC]
#   bank account / card nos. -> [ACCOUNT]
#   OTP / PIN codes          -> [CODE]
#
# Money amounts, dates, small numbers and website addresses are kept: the assistant needs
# them to explain a scam ("they asked for a Rs 2,500 fee", "the site is abc-jobs.lk").

import re
from dataclasses import dataclass, field
from typing import Dict, List

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)")

# Kept as they are: website addresses and money amounts.
_URL = re.compile(
    r"(?:https?://|www\.)\S+"
    r"|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:lk|com|net|org|io|co|info|biz|jobs|edu|gov|xyz|online)\b(?:/\S*)?",
    re.IGNORECASE,
)
_MONEY = re.compile(
    r"(?:\brs\.?|\blkr|\busd|\$|\brupees?)\s*\d[\d,]*(?:\.\d+)?"
    r"|\b\d[\d,]*(?:\.\d+)?\s*(?:rs\b|lkr\b|rupees?\b|/-)",
    re.IGNORECASE,
)

_CODE = re.compile(
    r"(?P<keep>\b(?:otp|pin|passcode|one[- ]time (?:password|code)|(?:verification |security )?code)"
    r"(?:\s+(?:is|number|no\.?))?\s*[:=#-]?\s*)(?P<value>\d{4,8})\b"
    r"|\b(?P<value2>\d{4,8})(?P<keep2>\s+is\s+your\s+(?:otp|pin|code|verification code))",
    re.IGNORECASE,
)
_NIC = re.compile(r"(?<![\w])(?:\d{9}[VvXx]|(?:19|20)\d{10})(?![\w])")
_PHONE = re.compile(
    r"(?<![\w+])(?:"
    r"(?:\+|00)94[\s-]?(?:\(0\))?\d(?:[\s-]?\d){8}"  # +94 77 123 4567, 0094 11 234 5678
    r"|94\d{9}"  # 94771234567
    r"|\(?0\d{2}\)?(?:[\s-]?\d){7}"  # 077 123 4567, 0112 345 678, (011) 234-5678
    r"|\+\d{1,3}(?:[\s-]?\d){6,12}"  # other countries
    r")(?!\d)"
)
_ACCOUNT_WITH_LABEL = re.compile(
    r"(?P<keep>\b(?:account|acc|acct|a/c|card)(?:\s*(?:no\.?|number|#))?\s*[:#-]?\s*)"
    r"(?P<value>\d(?:[\s-]?\d){5,22})(?!\d)",
    re.IGNORECASE,
)
_CARD = re.compile(r"(?<!\d)\d{4}(?:[\s-]\d{4}){2,3}(?:[\s-]\d{1,3})?(?!\d)")
_LONG_NUMBER = re.compile(r"(?<![\w])\d{9,19}(?![\w])")

# Private-use characters (never digits or letters) mark protected spans while masking.
_OPEN, _CLOSE = "\ue000", "\ue001"
_SLOT = re.compile(f"{_OPEN}(.){_CLOSE}")


@dataclass(frozen=True)
class Redaction:
    text: str
    counts: Dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.counts.values())


def _protect(text: str, pattern: re.Pattern, kept: List[str]) -> str:
    def slot(m: re.Match) -> str:
        kept.append(m.group(0))
        return f"{_OPEN}{chr(0xE100 + len(kept) - 1)}{_CLOSE}"

    return pattern.sub(slot, text)


def redact(text: str) -> Redaction:
    """Mask personal data in `text`. Returns the masked text and how many of each kind were hidden."""
    counts: Dict[str, int] = {}

    def count(kind: str) -> None:
        counts[kind] = counts.get(kind, 0) + 1

    def mask(kind: str, placeholder: str):
        def sub(m: re.Match) -> str:
            count(kind)
            return placeholder

        return sub

    def mask_value(kind: str, placeholder: str):
        def sub(m: re.Match) -> str:
            count(kind)
            if m.groupdict().get("value2") is not None:
                return placeholder + m.group("keep2")
            return m.group("keep") + placeholder

        return sub

    def mask_email(m: re.Match) -> str:
        count("email")
        return f"[EMAIL]@{m.group(1)}"

    out = EMAIL.sub(mask_email, text)

    kept: List[str] = []
    out = _protect(out, _URL, kept)
    out = _protect(out, _MONEY, kept)

    out = _CODE.sub(mask_value("code", "[CODE]"), out)
    out = _NIC.sub(mask("nic", "[NIC]"), out)
    out = _ACCOUNT_WITH_LABEL.sub(mask_value("account", "[ACCOUNT]"), out)
    out = _CARD.sub(mask("account", "[ACCOUNT]"), out)
    out = _PHONE.sub(mask("phone", "[PHONE]"), out)
    out = _LONG_NUMBER.sub(mask("account", "[ACCOUNT]"), out)

    out = _SLOT.sub(lambda m: kept[ord(m.group(1)) - 0xE100], out)
    return Redaction(out, counts)
