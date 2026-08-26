"""
Curated Sri Lanka entities that are publicly known as registered / licensed.
Used when live eROC/CSE lookups flake, so well-known companies still resolve.

Only include entities that are verifiably listed/licensed (CSE, CBSL, state banks, etc.).
Private Pvt Ltd firms without a public listing should NOT be hard-coded here.
"""

from __future__ import annotations

# key: normalized lowercase name (spaces, no punctuation)
# value: registry flags + display source
KNOWN_REGISTERED: dict[str, dict] = {
    # CSE / large listed
    "dialog axiata plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_symbol": "DIAL",
        "cse_registered_name": "Dialog Axiata PLC",
    },
    "dialog axiata": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_symbol": "DIAL",
        "cse_registered_name": "Dialog Axiata PLC",
    },
    "dialog": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_symbol": "DIAL",
        "cse_registered_name": "Dialog Axiata PLC",
    },
    "john keells holdings plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_symbol": "JKH",
        "cse_registered_name": "John Keells Holdings PLC",
    },
    "john keells holdings": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_symbol": "JKH",
        "cse_registered_name": "John Keells Holdings PLC",
    },
    "john keells": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_symbol": "JKH",
        "cse_registered_name": "John Keells Holdings PLC",
    },
    "keells": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_symbol": "JKH",
        "cse_registered_name": "John Keells Holdings PLC",
    },
    "cargills ceylon plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Cargills (Ceylon) PLC",
    },
    "cargills ceylon": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Cargills (Ceylon) PLC",
    },
    "cargills": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Cargills (Ceylon) PLC",
    },
    "sri lanka telecom plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Sri Lanka Telecom PLC",
    },
    "sri lanka telecom": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Sri Lanka Telecom PLC",
    },
    "slt": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Sri Lanka Telecom PLC",
    },
    "richard pieris and company plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Richard Pieris and Company PLC",
    },
    "arpico": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity (Richard Pieris / Arpico)",
        "cse_registered_name": "Richard Pieris and Company PLC",
    },
    "softlogic holdings plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Softlogic Holdings PLC",
    },
    "softlogic holdings": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Softlogic Holdings PLC",
    },
    "softlogic": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Softlogic Holdings PLC",
    },
    "lolc holdings plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "LOLC Holdings PLC",
    },
    "lolc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "LOLC Holdings PLC",
    },
    "access engineering plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Access Engineering PLC",
    },
    "access engineering": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Access Engineering PLC",
    },
    "singer sri lanka plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Singer (Sri Lanka) PLC",
    },
    "singer sri lanka": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Singer (Sri Lanka) PLC",
    },
    "abans electricals plc": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Abans Electricals PLC",
    },
    "abans": {
        "is_cse_listed": 1,
        "reg_source": "Colombo Stock Exchange (CSE) — known listed entity",
        "cse_registered_name": "Abans Electricals PLC",
    },
    # Banks / CBSL
    "commercial bank of ceylon plc": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Commercial Bank of Ceylon PLC",
    },
    "commercial bank": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Commercial Bank of Ceylon PLC",
    },
    "combank": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Commercial Bank of Ceylon PLC",
    },
    "hatton national bank plc": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Hatton National Bank PLC",
    },
    "hatton national bank": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Hatton National Bank PLC",
    },
    "hnb": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Hatton National Bank PLC",
    },
    "sampath bank plc": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Sampath Bank PLC",
    },
    "sampath bank": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Sampath Bank PLC",
    },
    "people s bank": {
        "is_cbsl_licensed": 1,
        "reg_source": "CBSL licensed state bank",
        "cse_registered_name": "People's Bank",
    },
    "peoples bank": {
        "is_cbsl_licensed": 1,
        "reg_source": "CBSL licensed state bank",
        "cse_registered_name": "People's Bank",
    },
    "bank of ceylon": {
        "is_cbsl_licensed": 1,
        "reg_source": "CBSL licensed state bank",
        "cse_registered_name": "Bank of Ceylon",
    },
    "boc": {
        "is_cbsl_licensed": 1,
        "reg_source": "CBSL licensed state bank",
        "cse_registered_name": "Bank of Ceylon",
    },
    "national savings bank": {
        "is_cbsl_licensed": 1,
        "reg_source": "CBSL licensed state bank",
        "cse_registered_name": "National Savings Bank",
    },
    "nsb": {
        "is_cbsl_licensed": 1,
        "reg_source": "CBSL licensed state bank",
        "cse_registered_name": "National Savings Bank",
    },
    "national development bank plc": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "National Development Bank PLC",
    },
    "ndb": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "National Development Bank PLC",
    },
    "dfcc bank plc": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "DFCC Bank PLC",
    },
    "dfcc": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "DFCC Bank PLC",
    },
    "seylan bank plc": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Seylan Bank PLC",
    },
    "seylan bank": {
        "is_cse_listed": 1,
        "is_cbsl_licensed": 1,
        "reg_source": "CSE listed + CBSL licensed bank",
        "cse_registered_name": "Seylan Bank PLC",
    },
}


def _norm_key(name: str) -> str:
    import re

    text = re.sub(r"[\u2018\u2019\u201c\u201d'\"()\[\],.&/\\-]", " ", (name or "").lower())
    return " ".join(text.split())


def lookup_known_registered(company_name: str | None) -> dict | None:
    """Return known registry flags if the company/brand is in the curated list."""
    key = _norm_key(company_name or "")
    if not key:
        return None
    if key in KNOWN_REGISTERED:
        return dict(KNOWN_REGISTERED[key])
    # contains match for longer keys (prefer longer brand match)
    best = None
    best_len = 0
    for known, payload in KNOWN_REGISTERED.items():
        if known in key or key in known:
            if len(known) > best_len:
                best = payload
                best_len = len(known)
    return dict(best) if best else None
