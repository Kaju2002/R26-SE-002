"""
Map common Sri Lanka brand / trade names to legal entity names used by CSE etc.
Registry lookups match legal names, not shop brands — without this, well-known
brands (e.g. Arpico Super Center) correctly scrape the website but fail CSE.
"""

from __future__ import annotations

from urllib.parse import urlparse

# brand / phrase (lowercase) -> preferred legal / CSE search names (ordered)
BRAND_LEGAL_ALIASES: dict[str, list[str]] = {
    "arpico": ["Richard Pieris and Company PLC", "Richard Pieris Distributors"],
    "arpico super center": ["Richard Pieris and Company PLC", "Richard Pieris Distributors"],
    "arpico supercen ter": ["Richard Pieris and Company PLC"],
    "keells": ["John Keells Holdings PLC"],
    "keells super": ["John Keells Holdings PLC"],
    "jkhs": ["John Keells Holdings PLC"],
    "john keells": ["John Keells Holdings PLC"],
    "cargills": ["Cargills (Ceylon) PLC", "Cargills Ceylon PLC"],
    "cargills food city": ["Cargills (Ceylon) PLC", "Cargills Ceylon PLC"],
    "dialog": ["Dialog Axiata PLC"],
    "dialog axiata": ["Dialog Axiata PLC"],
    "slt": ["Sri Lanka Telecom PLC"],
    "sri lanka telecom": ["Sri Lanka Telecom PLC"],
    "mobitel": ["Sri Lanka Telecom PLC"],
    "commercial bank": ["Commercial Bank of Ceylon PLC"],
    "combank": ["Commercial Bank of Ceylon PLC"],
    "hatton national bank": ["Hatton National Bank PLC"],
    "hnb": ["Hatton National Bank PLC"],
    "sampath bank": ["Sampath Bank PLC"],
    "sampath": ["Sampath Bank PLC"],
    "peoples bank": ["People's Bank", "Peoples Bank"],
    "people's bank": ["People's Bank", "Peoples Bank"],
    "peoples' bank": ["People's Bank", "Peoples Bank"],
    "bank of ceylon": ["Bank of Ceylon"],
    "boc": ["Bank of Ceylon"],
    "nsb": ["National Savings Bank"],
    "national savings bank": ["National Savings Bank"],
    "ndb": ["National Development Bank PLC"],
    "dfcc": ["DFCC Bank PLC"],
    "seylan": ["Seylan Bank PLC"],
    "seylan bank": ["Seylan Bank PLC"],
    "pan asia bank": ["Pan Asia Banking Corporation PLC"],
    "union bank": ["Union Bank of Colombo PLC"],
    "softlogic": ["Softlogic Holdings PLC"],
    "softlogic holdings": ["Softlogic Holdings PLC"],
    "abans": ["Abans Electricals PLC", "ABANS ELECTRICALS PLC"],
    "singer sri lanka": ["Singer (Sri Lanka) PLC", "Singer Sri Lanka PLC"],
    "singer": ["Singer (Sri Lanka) PLC"],
    "lkme": ["L O L C Holdings PLC", "LOLC Holdings PLC"],
    "lolc": ["L O L C Holdings PLC", "LOLC Holdings PLC"],
    "aet": ["Access Engineering PLC"],
    "access engineering": ["Access Engineering PLC"],
    "pickme": ["Digital Mobility Solutions Lanka (Pvt) Ltd"],
    "uber": ["Uber"],
}

# website host (lowercase, no www) -> legal names
DOMAIN_LEGAL_ALIASES: dict[str, list[str]] = {
    "arpico.com": ["Richard Pieris and Company PLC", "Richard Pieris Distributors"],
    "keellssuper.com": ["John Keells Holdings PLC"],
    "johnkeells.com": ["John Keells Holdings PLC"],
    "keells.com": ["John Keells Holdings PLC"],
    "cargillsceylon.com": ["Cargills (Ceylon) PLC", "Cargills Ceylon PLC"],
    "dialog.lk": ["Dialog Axiata PLC"],
    "slt.lk": ["Sri Lanka Telecom PLC"],
    "mobitel.lk": ["Sri Lanka Telecom PLC"],
    "combank.net": ["Commercial Bank of Ceylon PLC"],
    "hnb.net": ["Hatton National Bank PLC"],
    "sampath.lk": ["Sampath Bank PLC"],
    "boc.lk": ["Bank of Ceylon"],
    "peoplesbank.lk": ["People's Bank", "Peoples Bank"],
    "softlogic.lk": ["Softlogic Holdings PLC"],
    "abansgroup.com": ["Abans Electricals PLC"],
    "singer.lk": ["Singer (Sri Lanka) PLC"],
    "lolc.com": ["L O L C Holdings PLC"],
    "accessengsl.com": ["Access Engineering PLC"],
}


def _host_from_url(website_url: str | None) -> str:
    if not website_url:
        return ""
    raw = website_url.strip()
    if "://" not in raw:
        raw = "https://" + raw
    host = (urlparse(raw).netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def resolve_lookup_names(company_name: str | None, website_url: str | None = None) -> list[str]:
    """
    Return ordered unique names to try for registry lookup.
    Always starts with the user-entered name, then brand/domain aliases.
    """
    names: list[str] = []
    seen: set[str] = set()

    def _add(value: str | None) -> None:
        text = (value or "").strip()
        if not text:
            return
        key = text.lower()
        if key in seen:
            return
        seen.add(key)
        names.append(text)

    _add(company_name)

    normalized = " ".join((company_name or "").lower().split())
    normalized_plain = (
        normalized.replace("\u2018", "'").replace("\u2019", "'").replace("'", "'")
    )
    alias_keys = (normalized, normalized_plain, normalized_plain.replace("'", ""))
    matched_exact = False
    for key in alias_keys:
        if key in BRAND_LEGAL_ALIASES:
            matched_exact = True
            for alias in BRAND_LEGAL_ALIASES[key]:
                _add(alias)

    if not matched_exact:
        needle = normalized_plain.replace("'", "")
        for brand, aliases in BRAND_LEGAL_ALIASES.items():
            brand_plain = brand.replace("'", "")
            if brand_plain in needle or needle in brand_plain or brand in normalized_plain:
                for alias in aliases:
                    _add(alias)

    host = _host_from_url(website_url)
    if host in DOMAIN_LEGAL_ALIASES:
        for alias in DOMAIN_LEGAL_ALIASES[host]:
            _add(alias)

    return names
