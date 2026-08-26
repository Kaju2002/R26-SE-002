"""
SLAASMB Specified Business Enterprise (SBE) list lookup.

Source: https://slaasmb.gov.lk/list-of-companies/
This is NOT company registration (DRC/eROC). A match means the name appears
on SLAASMB's public SBE monitoring list (large / regulated entities).
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SLAASMB_LIST_URLS = (
    "https://slaasmb.gov.lk/list-of-companies/",
    "https://slaasmb.gov.lk/en/list-of-companies/",
)

_CACHE_TTL_SEC = float(os.getenv("SLAASMB_CACHE_TTL_SEC", str(7 * 24 * 3600)))
_HTTP_TIMEOUT = float(os.getenv("SLAASMB_HTTP_TIMEOUT", "12"))

_DATA_DIR = Path(__file__).resolve().parent / "data"
_CACHE_PATH = _DATA_DIR / "slaasmb_sbe_cache.json"
_SEED_PATH = _DATA_DIR / "slaasmb_sbe_seed.json"

_LEGAL_NOISE = {
    "pvt",
    "private",
    "limited",
    "ltd",
    "plc",
    "inc",
    "company",
    "co",
    "corporation",
    "corp",
    "the",
    "and",
    "of",
    "sri",
    "lanka",
}

_memory: dict | None = None


def _norm(name: str) -> str:
    text = re.sub(r"[\u2018\u2019\u201c\u201d'\"()\[\],.&/\\-]", " ", (name or "").lower())
    return " ".join(text.split())


def _tokens(name: str) -> set[str]:
    return {t for t in _norm(name).split() if t and t not in _LEGAL_NOISE and len(t) > 1}


def _parse_names_from_html(html: str) -> list[str]:
    soup = BeautifulSoup(html or "", "html.parser")
    names: list[str] = []
    seen: set[str] = set()

    # Tables are the primary layout on the list page
    for cell in soup.select("table td, table th"):
        text = " ".join(cell.get_text(" ", strip=True).split())
        if not text or len(text) < 3:
            continue
        lower = text.lower()
        if "list of sbe" in lower or "list of companies" in lower:
            continue
        if lower in {"name", "company", "no", "#"}:
            continue
        key = _norm(text)
        if key in seen or len(key) < 3:
            continue
        seen.add(key)
        names.append(text)

    # Fallback: list items
    if len(names) < 50:
        for li in soup.select("li"):
            text = " ".join(li.get_text(" ", strip=True).split())
            if not text or len(text) < 3:
                continue
            key = _norm(text)
            if key in seen:
                continue
            # Prefer rows that look like company names
            if not any(s in text.lower() for s in ("ltd", "plc", "limited", "pvt", "bank", "board")):
                continue
            seen.add(key)
            names.append(text)

    return names


def _load_json(path: Path) -> dict | None:
    try:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save_json(path: Path, payload: dict) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=0), encoding="utf-8")
    except Exception as exc:
        logger.debug("[REG:SLAASMB] cache write failed: %s", str(exc)[:120])


def _fetch_live_names() -> list[str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; FraudAwareEmployerCheck/1.0; +local)",
        "Accept": "text/html,application/xhtml+xml",
    }
    for url in SLAASMB_LIST_URLS:
        try:
            resp = requests.get(url, headers=headers, timeout=_HTTP_TIMEOUT)
            resp.raise_for_status()
            names = _parse_names_from_html(resp.text)
            if len(names) >= 50:
                logger.info("[REG:SLAASMB] fetched %d SBE names from %s", len(names), url)
                return names
            logger.warning("[REG:SLAASMB] sparse parse (%d names) from %s", len(names), url)
        except Exception as exc:
            logger.warning("[REG:SLAASMB] fetch failed %s: %s", url, str(exc)[:160])
    return []


def get_slaasmb_sbe_names(*, force_refresh: bool = False) -> list[str]:
    """Return cached/live/seed SBE company names."""
    global _memory
    now = time.time()

    if not force_refresh and _memory is not None:
        ts = float(_memory.get("fetched_at") or 0)
        names = _memory.get("names") or []
        if names and (now - ts) < _CACHE_TTL_SEC:
            return list(names)

    if not force_refresh:
        disk = _load_json(_CACHE_PATH)
        if disk:
            ts = float(disk.get("fetched_at") or 0)
            names = disk.get("names") or []
            if names and (now - ts) < _CACHE_TTL_SEC:
                _memory = disk
                return list(names)

    live = _fetch_live_names()
    if live:
        payload = {
            "source": "slaasmb.gov.lk/list-of-companies",
            "fetched_at": now,
            "names": live,
        }
        _save_json(_CACHE_PATH, payload)
        _memory = payload
        return list(live)

    # Stale cache still usable
    disk = _load_json(_CACHE_PATH) or _load_json(_SEED_PATH)
    if disk and disk.get("names"):
        logger.info("[REG:SLAASMB] using offline cache/seed (%d names)", len(disk["names"]))
        _memory = disk
        return list(disk["names"])

    logger.warning("[REG:SLAASMB] no SBE list available")
    return []


def lookup_slaasmb_sbe(company_name: str | None) -> dict:
    """
    Match company_name against SLAASMB SBE list.
    Returns dict with is_slaasmb_registered=1 on hit, else {}.
    """
    query = (company_name or "").strip()
    if not query:
        return {}

    names = get_slaasmb_sbe_names()
    if not names:
        return {}

    q_norm = _norm(query)
    q_tokens = _tokens(query)
    if not q_norm:
        return {}

    best_name = None
    best_score = -1

    for name in names:
        n_norm = _norm(name)
        if not n_norm:
            continue

        score = 0
        if q_norm == n_norm:
            score = 100
        elif q_norm in n_norm or n_norm in q_norm:
            # Prefer longer overlap; reject tiny substring traps
            shorter = min(len(q_norm), len(n_norm))
            longer = max(len(q_norm), len(n_norm))
            if shorter >= 6 and shorter / longer >= 0.45:
                score = 80 + min(15, shorter // 4)
        else:
            n_tokens = _tokens(name)
            if not q_tokens or not n_tokens:
                continue
            overlap = len(q_tokens & n_tokens)
            need = 2 if len(q_tokens) >= 2 else 1
            if overlap < need:
                continue
            # Avoid matching on a single generic token
            if overlap == 1 and len(q_tokens) > 1:
                continue
            score = 40 + overlap * 12
            if overlap == len(q_tokens) and overlap >= 2:
                score += 15

        if score > best_score:
            best_score = score
            best_name = name
            if score >= 100:
                break

    # Require a reasonably confident match
    if not best_name or best_score < 55:
        return {}

    logger.info(
        "[REG:SLAASMB] matched %r -> %r (score=%s)",
        query,
        best_name,
        best_score,
    )
    return {
        "is_slaasmb_registered": 1,
        "reg_name": best_name,
        "reg_source": "SLAASMB Specified Business Enterprise (SBE) list",
        "slaasmb_sbe_name": best_name,
        "slaasmb_match_score": best_score,
    }
