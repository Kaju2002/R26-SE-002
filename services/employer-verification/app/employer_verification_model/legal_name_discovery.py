"""Find legal company names written on a website (footer, copyright line, About/Contact text).

Important: a website can copy ANY company's legal name, so a name found here is only a claim.
It is looked up in the registers, but the result is treated as weaker evidence than a direct match
(see scoring_layer: registration_via_website_name).
"""
from __future__ import annotations

import re
from typing import List
from urllib.parse import urlparse

_SUFFIX_TOKENS = {"ltd", "ltd.", "limited", "plc", "plc."}
_PVT_TOKENS = {"(pvt)", "pvt", "(pvt.)", "pvt.", "(private)", "private"}
_STOP_BEFORE = {"copyright", "©", "by", "all", "rights", "reserved", "the", "of", "and", "to", "from", "at", "is"}
_WORD = re.compile(r"^[A-Z][A-Za-z0-9&'\-]*$")
MAX_WORDS = 6


def _clean(tok: str) -> str:
    return tok.strip(" \t\r\n,;:|•·–—")


def _brand_labels(company_name: str, website_url: str | None) -> List[str]:
    labels = [t.lower() for t in re.findall(r"[A-Za-z0-9]+", company_name or "") if len(t) >= 4]
    host = (urlparse(website_url or "").hostname or "").lower()
    if host:
        parts = [p for p in host.split(".") if p not in ("www", "com", "lk", "net", "org", "co", "gov", "edu", "info", "biz")]
        labels += [p for p in parts if len(p) >= 4]
    generic = {"sri", "lanka", "ceylon", "group", "holdings", "limited", "private"}
    return [l for l in dict.fromkeys(labels) if l not in generic]


def _related(candidate: str, labels: List[str]) -> bool:
    words = [w.lower().strip("().,") for w in candidate.split()]
    for label in labels:
        for w in words:
            if len(w) >= 4 and (w.startswith(label) or label.startswith(w)):
                return True
    return False


def discover_legal_names(text: str, company_name: str, website_url: str | None = None, limit: int = 2) -> List[str]:
    """Return up to `limit` legal names found in the page text that relate to the entered name or the website domain."""
    if not text:
        return []
    labels = _brand_labels(company_name, website_url)
    if not labels:
        return []
    tokens = [_clean(t) for t in text.replace(" ", " ").split()]
    tokens = [t for t in tokens if t]
    found: List[str] = []
    for i, tok in enumerate(tokens):
        low = tok.lower()
        if low not in _SUFFIX_TOKENS:
            continue
        end = i + 1
        start = i
        # optional "(Pvt)" / "Private" just before Ltd/Limited
        if start > 0 and tokens[start - 1].lower() in _PVT_TOKENS:
            start -= 1
        words: List[str] = []
        j = start - 1
        while j >= 0 and len(words) < MAX_WORDS:
            w = tokens[j]
            if w.lower() in _STOP_BEFORE or not _WORD.match(w):
                break
            words.insert(0, w)
            j -= 1
        if not words:
            continue
        name = " ".join(words + tokens[start:end]).rstrip(".")
        if _related(name, labels) and name not in found:
            found.append(name)
        if len(found) >= limit:
            break
    return found
