# app/company_input.py
# Split one line such as "ABC Holdings, www.abc.lk, hr@abc.lk" into name, website and email.

import re
from typing import Dict, Optional

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_URL = re.compile(r"(?:https?://)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,24})(?:/[^\s,;]*)?", re.I)
# "Pvt.Ltd" or "Co.Inc" are company suffixes, not websites.
_NOT_TLDS = {"ltd", "inc", "plc", "pvt", "llc", "corp"}
_FIELD_LABELS = re.compile(r"\b(?:company(?:\s+name)?|name|website|web\s*site|site|url|e-?mail|mail)\s*[:=-]\s*", re.I)
_SEPARATORS = re.compile(r"[,;|\n]+")


def _find_url(text: str) -> Optional[re.Match]:
    for match in _URL.finditer(text):
        if match.group(1).lower() not in _NOT_TLDS:
            return match
    return None


def parse_company_details(text: str) -> Dict[str, Optional[str]]:
    rest = text or ""

    email = None
    match = _EMAIL.search(rest)
    if match:
        email = match.group(0)
        rest = rest[: match.start()] + " " + rest[match.end():]

    website = None
    match = _find_url(rest)
    if match:
        website = match.group(0).rstrip(".")
        rest = rest[: match.start()] + " " + rest[match.end():]

    rest = _FIELD_LABELS.sub(" ", rest)
    parts = [p.strip(" .:-\t") for p in _SEPARATORS.split(rest)]
    name = next((" ".join(p.split()) for p in parts if p), None)

    return {"company_name": name, "website_url": website, "email": email}
