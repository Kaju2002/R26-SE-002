from __future__ import annotations

import base64
import logging
import os
import re
import time
import warnings
from copy import deepcopy
from typing import Dict

import requests
from bs4 import BeautifulSoup

# Load .env file for environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Optional Selenium (slow). eROC ON improves Pvt Ltd detection; CSE stays API-only.
USE_EROC_SELENIUM = os.getenv("EROC_USE_SELENIUM", "0") == "1"
USE_CSE_SELENIUM = os.getenv("CSE_USE_SELENIUM", "0") == "1"
EROC_SELENIUM_TIMEOUT = float(os.getenv("EROC_SELENIUM_TIMEOUT", "18"))
SKIP_HEAVY_DDGS_AFTER_SELENIUM = os.getenv("REG_SKIP_HEAVY_DDGS_AFTER_SELENIUM", "1") == "1"
CSE_API_TIMEOUT = float(os.getenv("CSE_API_TIMEOUT", "6"))
REG_HTTP_TIMEOUT = float(os.getenv("REG_HTTP_TIMEOUT", "5"))
_CSE_ALL_SECURITY_CODE_URL = "https://www.cse.lk/api/allSecurityCode"
_CSE_API_KEY = os.getenv("CSE_API_KEY", "Cse123Api").strip()
_CHROME_SERVICE = None
_CHROME_SERVICE_TRIED = False

logger = logging.getLogger(__name__)


def _get_chrome_service():
    """Reuse ChromeDriver path across lookups (webdriver-manager install is expensive)."""
    global _CHROME_SERVICE, _CHROME_SERVICE_TRIED
    if _CHROME_SERVICE_TRIED:
        return _CHROME_SERVICE
    _CHROME_SERVICE_TRIED = True
    try:
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager

        _CHROME_SERVICE = Service(ChromeDriverManager().install())
    except Exception as exc:
        logger.debug("[REG] ChromeDriverManager unavailable: %s", str(exc)[:160])
        _CHROME_SERVICE = None
    return _CHROME_SERVICE


def _chrome_options():
    from selenium.webdriver.chrome.options import Options

    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,900")
    options.add_argument("--blink-settings=imagesEnabled=false")
    options.add_argument("--disable-extensions")
    options.page_load_strategy = "eager"
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    return options


def _normalize_url(url: str) -> str:
    """Normalize URL to handle common malformations.
    
    Examples:
    - 'https;//example.com' -> 'https://example.com'
    - 'http;example.com' -> 'http://example.com'
    - 'example.com' -> 'http://example.com'
    """
    if not url:
        return url
    
    url = url.strip()
    
    # Fix semicolons in scheme (e.g., https;// -> https://, http;// -> http://)
    # Handle both https;// and http; patterns
    url = re.sub(r'^([a-z]+);/?/?', r'\1://', url, flags=re.IGNORECASE)
    
    # Ensure URL has a scheme (prefer https for live checks)
    if not re.match(r'^[a-z]+://', url, re.IGNORECASE):
        url = 'https://' + url
    
    return url


def _check_eroc_with_selenium(company_name: str, timeout: float | None = None) -> Dict[str, object]:
    """Render eROC with headless Chrome. Capped (~18s) so /predict stays under ~1 minute."""
    if timeout is None:
        timeout = EROC_SELENIUM_TIMEOUT
    timeout = max(8.0, min(float(timeout), 25.0))

    result = {
        "is_registered": False,
        "reg_number": None,
        "reg_name": None,
        "source": "eROC - Department of Registrar of Companies (Selenium)",
    }
    t0 = time.time()

    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.common.keys import Keys
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        service = _get_chrome_service()
        options = _chrome_options()
        driver = (
            webdriver.Chrome(service=service, options=options)
            if service is not None
            else webdriver.Chrome(options=options)
        )

        try:
            driver.set_page_load_timeout(int(timeout))
            driver.get("https://eroc.drc.gov.lk/")
            wait = WebDriverWait(driver, timeout)

            search_el = None
            for sel in [
                "input[type='search']",
                "input[placeholder*='Search']",
                "input[placeholder*='Company']",
                "input[placeholder*='search']",
                "input[name*='search']",
                "#search",
                "input[type='text']",
            ]:
                try:
                    search_el = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, sel)))
                    if search_el and search_el.is_displayed():
                        break
                except Exception:
                    search_el = None
                    continue

            if not search_el:
                try:
                    search_el = wait.until(EC.presence_of_element_located((By.TAG_NAME, "input")))
                except Exception:
                    logger.info("[REG:eROC:Selenium] no search input (%.1fs)", time.time() - t0)
                    return result

            try:
                search_el.clear()
            except Exception:
                pass
            search_el.send_keys(company_name)
            try:
                search_el.send_keys(Keys.ENTER)
            except Exception:
                driver.execute_script(
                    "arguments[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));",
                    search_el,
                )

            remaining = max(2.0, timeout - (time.time() - t0))
            try:
                WebDriverWait(driver, remaining).until(
                    EC.any_of(
                        EC.presence_of_element_located((By.TAG_NAME, "table")),
                        EC.presence_of_element_located(
                            (By.CSS_SELECTOR, ".search-results, .result, [class*='result']")
                        ),
                    )
                )
            except Exception:
                time.sleep(min(1.5, remaining))

            page = driver.page_source
            soup = BeautifulSoup(page, "html.parser")
            tokens = [w for w in (company_name or "").lower().split() if len(w) > 2]

            for row in soup.find_all("tr"):
                cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
                if not cells:
                    continue
                joined = " ".join(cells).lower()
                if tokens and sum(1 for tok in tokens if tok in joined) >= max(1, min(2, len(tokens))):
                    result["is_registered"] = True
                    result["reg_name"] = cells[0]
                    if len(cells) > 1:
                        result["reg_number"] = cells[1]
                    logger.info(
                        "[REG:eROC:Selenium] match %r / %r in %.1fs",
                        result.get("reg_name"),
                        result.get("reg_number"),
                        time.time() - t0,
                    )
                    return result

            candidates = soup.find_all(
                string=lambda s: s
                and any(
                    k in s.lower()
                    for k in ("registration no", "reg no", "registration number", "pv0", "pv ")
                )
            )
            for c in candidates:
                parent = c.parent
                text = parent.get_text(" ", strip=True)
                if tokens and any(tok in text.lower() for tok in tokens):
                    result["is_registered"] = True
                    m = re.search(
                        r"(PV\d+[A-Za-z0-9]*|reg(istration)?\s*(no|number)?[:\s]*([A-Za-z0-9\-\/]+))",
                        text,
                        re.I,
                    )
                    if m:
                        result["reg_number"] = m.group(0)
                    heading = parent.find_previous(["h1", "h2", "h3"]) or parent.find_previous("strong")
                    if heading:
                        result["reg_name"] = heading.get_text(strip=True)
                    logger.info("[REG:eROC:Selenium] keyword match in %.1fs", time.time() - t0)
                    return result

            logger.info("[REG:eROC:Selenium] no match for %r (%.1fs)", company_name, time.time() - t0)
            return result
        finally:
            try:
                driver.quit()
            except Exception:
                pass
    except Exception as exc:
        logger.warning("[REG:eROC:Selenium] failed: %s", str(exc)[:200])
        return result


def _check_cse_with_selenium(company_name: str, timeout: int = 12) -> Dict[str, object]:
    """Search the CSE listed-company directory using Selenium (kept OFF by default)."""
    result = {
        "is_registered": False,
        "symbol": None,
        "reg_name": None,
        "source": "Colombo Stock Exchange (CSE) directory (rendered)",
    }

    if not company_name:
        return result

    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.common.keys import Keys
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        service = _get_chrome_service()
        options = _chrome_options()
        driver = (
            webdriver.Chrome(service=service, options=options)
            if service is not None
            else webdriver.Chrome(options=options)
        )
        try:
            driver.set_page_load_timeout(timeout)
            driver.get("https://www.cse.lk/listed-entities/listed-company-directory?page=ALPHABETICAL")

            wait = WebDriverWait(driver, timeout)
            search_boxes = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "input[placeholder='Search']")))
            search_box = search_boxes[-1]
            search_box.clear()
            search_box.send_keys(company_name)
            search_box.send_keys(Keys.ENTER)

            try:
                wait.until(lambda d: company_name.lower() in d.find_element(By.TAG_NAME, "body").text.lower() or "no results found" in d.find_element(By.TAG_NAME, "body").text.lower())
            except Exception:
                pass

            body_text = driver.find_element(By.TAG_NAME, "body").text
            if _text_mentions_company(body_text, company_name):
                result["is_registered"] = True

                links = driver.find_elements(By.CSS_SELECTOR, "a[href^='/company-profile?symbol=']")
                for link in links:
                    link_text = (link.text or "").strip()
                    if _text_mentions_company(link_text or body_text, company_name):
                        href = link.get_attribute("href") or ""
                        match = re.search(r"symbol=([^&]+)", href)
                        if match:
                            result["symbol"] = match.group(1)
                        if link_text:
                            result["reg_name"] = link_text
                        break

                if not result.get("reg_name"):
                    result["reg_name"] = company_name
                return result

            return result
        finally:
            try:
                driver.quit()
            except Exception:
                pass
    except Exception as exc:
        logger.debug("[REG:CSE:Selenium] Selenium attempt failed or not available: %s", str(exc)[:200])
        return result


_CSE_LISTINGS_CACHE: list | None = None
_CSE_LISTINGS_CACHE_TS: float = 0.0
_CSE_CACHE_TTL_SEC = float(os.getenv("CSE_CACHE_TTL_SEC", "3600"))
_REG_RESULT_CACHE: dict[str, tuple[float, dict]] = {}
_REG_RESULT_CACHE_TTL_SEC = float(os.getenv("REG_RESULT_CACHE_TTL_SEC", "1800"))


def _get_cse_listings(timeout: float) -> list:
    """Fetch CSE listings once and reuse for ~1 hour (big latency win)."""
    import time as _time

    global _CSE_LISTINGS_CACHE, _CSE_LISTINGS_CACHE_TS
    now = _time.time()
    if _CSE_LISTINGS_CACHE is not None and (now - _CSE_LISTINGS_CACHE_TS) < _CSE_CACHE_TTL_SEC:
        return _CSE_LISTINGS_CACHE

    api_key = base64.b64encode(_CSE_API_KEY.encode("utf-8")).decode("ascii")
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; verifier/1.0)",
        "x-api-key": api_key,
    }
    response = requests.get(_CSE_ALL_SECURITY_CODE_URL, headers=headers, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, list):
        _CSE_LISTINGS_CACHE = payload
        _CSE_LISTINGS_CACHE_TS = now
    return payload if isinstance(payload, list) else []


def _check_cse_with_api(company_name: str, timeout: float | None = None) -> Dict[str, object]:
    """Query the CSE listed-company API directly and match the returned listings."""
    if timeout is None:
        timeout = CSE_API_TIMEOUT
    result = {
        "is_registered": False,
        "symbol": None,
        "reg_name": None,
        "source": "Colombo Stock Exchange (CSE) API",
    }

    if not company_name:
        return result

    try:
        payload = _get_cse_listings(timeout)
    except Exception as exc:
        logger.debug("[REG:CSE:API] Direct lookup failed for %s: %s", company_name, str(exc)[:200])
        return result

    if not isinstance(payload, list):
        logger.debug("[REG:CSE:API] Unexpected payload type for %s: %s", company_name, type(payload).__name__)
        return result

    normalized_name = _normalize_company(company_name)
    search_tokens = _company_search_tokens(company_name)

    for item in payload:
        if not isinstance(item, dict):
            continue

        name = str(item.get("name", "")).strip()
        symbol = str(item.get("symbol", "")).strip()
        if not name:
            continue

        if normalized_name and normalized_name not in _normalize_company(name):
            if not _text_mentions_company(name, company_name):
                # Also allow strong token overlap (Dialog vs Dialog Axiata PLC)
                q_tokens = set(_company_search_tokens(company_name))
                n_tokens = set(_company_search_tokens(name))
                if not q_tokens or not n_tokens:
                    continue
                overlap = q_tokens & n_tokens
                if len(overlap) < max(1, min(2, len(q_tokens))):
                    continue

        result["is_registered"] = True
        result["symbol"] = symbol or None
        result["reg_name"] = name
        return result

    logger.debug("[REG:CSE:API] No direct name match found for %s using tokens=%s", company_name, search_tokens)
    return result

from app.employer_verification_model.review_aggregator import aggregate_review_signals

OPEN_CORPORATES_API_URL = "https://api.opencorporates.com/v0.4/companies/search"
OPEN_CORPORATES_API_TOKEN = os.getenv("OPEN_CORPORATES_API_TOKEN", "").strip()

OFFICIAL_REGISTRY_SOURCES = [
    ("is_drc_registered", "DRC / eROC", ["eroc.drc.gov.lk", "drc.gov.lk"]),
    ("is_cse_listed", "Colombo Stock Exchange (CSE)", ["cse.lk"]),
    ("is_cbsl_licensed", "Central Bank of Sri Lanka (CBSL)", ["cbsl.gov.lk", "cbsl.lk"]),
    ("is_ircsl_registered", "Insurance Regulatory Commission of Sri Lanka (IRCSL)", ["ircsl.gov.lk", "ircsl.gov.lk"]),
    ("is_slaasmb_registered", "Sri Lanka Accounting and Auditing Standards Monitoring Board (SLAASMB)", ["slaasmb.gov.lk"]),
]

LEGAL_SUFFIXES = {
    "pvt", "private", "limited", "ltd", "plc", "inc", "incorporated", "company", "co", "corporation", "corp",
}

def _looks_like_regulated_finance(company_name: str) -> bool:
    """Banks/finance firms are confirmed via CSE/CBSL, not eROC Selenium."""
    n = (company_name or "").lower()
    markers = (
        "bank",
        "finance",
        "leasing",
        "insurance",
        "cbsl",
        "hnb",
        "boc",
        "combank",
        "sampath",
        "nsb",
        "ndb",
        "dfcc",
        "seylan",
        "pan asia",
        "union bank",
        "commercial bank",
        "people's bank",
        "peoples bank",
        "peoples' bank",
    )
    return any(m in n for m in markers)


def _normalize_company(company_name: str) -> str:
    text = re.sub(r"[\u2018\u2019\u201c\u201d'\"()\[\],.&/\\-]", " ", (company_name or "").lower())
    return " ".join(text.split())


def _company_search_tokens(company_name: str) -> list[str]:
    tokens = [token for token in _normalize_company(company_name).split() if token]
    filtered = [token for token in tokens if token not in LEGAL_SUFFIXES and len(token) > 2]
    return filtered or tokens


def _init_registration_trace(company_name: str, website_url: str | None) -> list[dict]:
    return [
        {"step": 0, "source": "input", "status": "received", "company_name": company_name, "website_url": website_url},
    ]


def _append_registration_trace(trace: list[dict], step: int, source: str, status: str, detail: str, **extra) -> None:
    item = {"step": step, "source": source, "status": status, "detail": detail}
    item.update(extra)
    trace.append(item)


def _text_mentions_company(text: str, company_name: str) -> bool:
    tokens = _company_search_tokens(company_name)
    haystack = _normalize_company(text)
    if not tokens or not haystack:
        return False

    if len(tokens) == 1:
        token = tokens[0]
        return token in haystack or token.rstrip("s") in haystack or haystack in token

    matches = sum(1 for token in tokens if token in haystack)
    return matches >= max(2, len(tokens) - 1)


def _search_official_registry(company_name: str, domains: list[str]) -> dict:
    """Search official registry domains with DDGS and require a company-name match in the snippet/title."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            from duckduckgo_search import DDGS
    except Exception:
        return {}

    company_name = (company_name or "").strip()
    if not company_name:
        return {}

    search_variants = [company_name, _normalize_company(company_name)]
    search_variants.extend([" ".join(_company_search_tokens(company_name))])

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            with DDGS() as ddgs_client:
                for domain in domains:
                    for variant in search_variants:
                        if not variant:
                            continue
                        query = f'"{variant}" site:{domain}'
                        try:
                            results = ddgs_client.text(query, max_results=5)
                        except Exception:
                            continue

                        for item in results or []:
                            text = " ".join(
                                str(item.get(key, "")) for key in ("title", "body", "href")
                            )
                            if _text_mentions_company(text, company_name):
                                return {
                                    "source": domain,
                                    "query": query,
                                    "match": item,
                                }
    except Exception:
        return {}

    return {}


def _fetch_page(url: str, timeout: int = 6) -> str:
    """Simple HTTP GET to fetch a page text; returns empty string on failure."""
    if not url:
        return ""
    
    # Normalize URL to handle common malformations
    url = _normalize_url(url)
    
    headers = {"User-Agent": "Mozilla/5.0 (compatible; verifier/1.0)"}
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.text or ""
    except Exception:
        return ""


def _opencorporates_registration_lookup(company_name: str) -> dict:
    """
    OpenCorporates company search (extra registry source — does not replace CSE/eROC/CBSL).
    Prefers Sri Lanka (jurisdiction_code=lk). Requires OPEN_CORPORATES_API_TOKEN.
    """
    if not OPEN_CORPORATES_API_TOKEN:
        logger.info("[REG:OC] skipped — OPEN_CORPORATES_API_TOKEN not set")
        return {}

    company_name = (company_name or "").strip()
    if not company_name:
        return {}

    def _search(extra: dict) -> list:
        params = {
            "q": company_name,
            "per_page": 10,
            "normalise_company_name": "true",
            "order": "score",
            "api_token": OPEN_CORPORATES_API_TOKEN,
            **extra,
        }
        try:
            response = requests.get(OPEN_CORPORATES_API_URL, params=params, timeout=10)
            response.raise_for_status()
            payload = response.json()
            return payload.get("results", {}).get("companies", []) or []
        except Exception as exc:
            logger.warning("[REG:OC] lookup failed for %s: %s", company_name, str(exc)[:160])
            return []

    # 1) Sri Lanka only  2) fallback global if nothing in lk
    rows = _search({"jurisdiction_code": "lk", "inactive": "false"})
    if not rows:
        rows = _search({"jurisdiction_code": "lk"})
    if not rows:
        rows = _search({"inactive": "false"})

    if not rows:
        logger.info("[REG:OC] no matches for %r", company_name)
        return {}

    q_norm = _normalize_company(company_name)
    q_tokens = set(_company_search_tokens(company_name))

    best = None
    best_score = -1
    for item in rows:
        company = item.get("company", {}) or {}
        name = str(company.get("name") or "")
        name_norm = _normalize_company(name)
        jurisdiction = str(company.get("jurisdiction_code") or "").lower()
        inactive = bool(company.get("inactive"))

        if q_norm and q_norm not in name_norm and name_norm not in q_norm:
            n_tokens = set(_company_search_tokens(name))
            overlap = len(q_tokens & n_tokens) if q_tokens and n_tokens else 0
            if overlap < max(1, min(2, len(q_tokens) or 1)):
                continue

        score = 0
        if jurisdiction == "lk":
            score += 5
        if not inactive:
            score += 2
        if q_norm and (q_norm == name_norm or q_norm in name_norm):
            score += 3
        if score > best_score:
            best_score = score
            best = company

    if not best:
        logger.info("[REG:OC] name matches found but none passed filters for %r", company_name)
        return {}

    jurisdiction = str(best.get("jurisdiction_code") or "").lower()
    registry_url = (best.get("registry_url") or "").lower()
    source = best.get("source") or {}
    publisher = (source.get("publisher") or "").lower()
    blob = " ".join(
        [
            str(best.get("name") or "").lower(),
            registry_url,
            publisher,
            jurisdiction,
            str(best.get("current_status") or "").lower(),
        ]
    )

    out = {
        "is_drc_registered": int(jurisdiction == "lk" or "sri lanka" in blob or "registrar" in blob),
        "is_cse_listed": int("cse" in blob or "stock exchange" in blob),
        "is_boi_registered": int("boi" in blob or "board of investment" in blob),
        "is_cbsl_licensed": int("cbsl" in blob or "central bank" in blob),
        "reg_name": best.get("name"),
        "reg_number": best.get("company_number"),
        "reg_source": f"OpenCorporates ({jurisdiction or 'unknown'})",
        "opencorporates_url": best.get("opencorporates_url"),
        "opencorporates_status": best.get("current_status"),
        "opencorporates_inactive": int(bool(best.get("inactive"))),
    }
    # If OC found an active LK company, treat as DRC-equivalent registration signal
    if jurisdiction == "lk" and not best.get("inactive"):
        out["is_drc_registered"] = 1

    if not any(out.get(k) for k in ("is_drc_registered", "is_cse_listed", "is_boi_registered", "is_cbsl_licensed")):
        # Still count a clear name hit in LK as registration evidence
        if jurisdiction == "lk":
            out["is_drc_registered"] = 1
        else:
            logger.info("[REG:OC] matched %r outside LK (%s) — not counting as LK registry", company_name, jurisdiction)
            return {}

    logger.info(
        "[REG:OC] matched %r -> %s (%s) inactive=%s",
        company_name,
        out.get("reg_name"),
        out.get("reg_number"),
        best.get("inactive"),
    )
    return out


def _merge_registry_hit(results: dict, hit: dict, *, method: str, trace_source: str, detail: str, step: int) -> None:
    """Merge flags/metadata from one registry source into the aggregated result."""
    if not hit:
        return
    flag_keys = (
        "is_cse_listed",
        "is_boi_registered",
        "is_cbsl_licensed",
        "is_drc_registered",
        "is_ircsl_registered",
        "is_slaasmb_registered",
    )
    any_flag = False
    for k in flag_keys:
        if hit.get(k):
            results[k] = 1
            any_flag = True
    if not any_flag and not hit.get("is_registered"):
        return
    if hit.get("is_registered"):
        # CSE-style helpers
        results["is_cse_listed"] = 1
        any_flag = True

    for meta in (
        "reg_name",
        "reg_number",
        "reg_source",
        "cse_symbol",
        "cse_registered_name",
        "opencorporates_url",
        "opencorporates_status",
        "matched_lookup_name",
        "slaasmb_sbe_name",
    ):
        if hit.get(meta) and not results.get(meta):
            results[meta] = hit.get(meta)

    sources = results.setdefault("registration_sources", [])
    if method and method not in sources:
        sources.append(method)
    results["registration_method"] = "+".join(sources) if sources else method

    _append_registration_trace(
        results["registration_trace"],
        step,
        trace_source,
        "registered",
        detail,
        **{k: hit.get(k) for k in ("reg_name", "reg_number", "lookup_name", "symbol") if hit.get(k)},
    )

def _apply_government_registration_verdict(result: dict) -> dict:
    methods = result.get("registration_sources") or []
    method_blob = " ".join(str(m) for m in methods) + " " + str(result.get("registration_method") or "")

    # Website-only keyword hints must never count as official registration
    website_only = (
        method_blob.strip() == "website_heuristics"
        or (result.get("registration_method") == "website_heuristics" and not methods)
    )

    official_sources = []
    if result.get("is_drc_registered") and not website_only:
        if any("eroc" in str(s).lower() for s in methods) or "drc_record" in methods or "known_entity" in methods:
            official_sources.append("DRC / eROC")
        if "opencorporates" in methods:
            official_sources.append("OpenCorporates")
        if not any(x in official_sources for x in ("DRC / eROC", "OpenCorporates")):
            official_sources.append("DRC / eROC")
    if result.get("is_boi_registered") and not website_only:
        official_sources.append("BOI")
    if result.get("is_cse_listed") and not website_only:
        official_sources.append("CSE")
    if result.get("is_cbsl_licensed") and not website_only:
        official_sources.append("CBSL")
    if result.get("is_ircsl_registered") and not website_only:
        official_sources.append("IRCSL")
    if result.get("is_slaasmb_registered") and not website_only:
        official_sources.append("SLAASMB")

    # De-dupe while preserving order
    seen = set()
    official_sources = [s for s in official_sources if not (s in seen or seen.add(s))]

    if official_sources:
        result["government_registration_status"] = "registered"
        result["government_registration_source"] = ", ".join(official_sources)
        result["is_government_registered"] = 1
    else:
        result["is_government_registered"] = 0
        result["government_registration_source"] = None
        if website_only or "website_heuristics" in method_blob:
            result["government_registration_status"] = "unverified"
        else:
            result["government_registration_status"] = "not_found"

    return result


def check_eroc_registration(company_name: str, *, use_selenium: bool | None = None) -> Dict[str, object]:
    """
    Query Sri Lanka's official eROC (DRC) search and return registration details.
    When Selenium is enabled, render the SPA once (capped timeout) for accuracy.
    """
    result = {
        "is_registered": False,
        "reg_number": None,
        "reg_name": None,
        "source": "eROC - Department of Registrar of Companies",
    }

    if use_selenium is None:
        use_selenium = USE_EROC_SELENIUM

    if use_selenium:
        try:
            selenium_result = _check_eroc_with_selenium(company_name, timeout=EROC_SELENIUM_TIMEOUT)
            if selenium_result.get("is_registered"):
                return selenium_result
            # Keep selenium source note even on miss so callers know we tried the SPA
            result["source"] = selenium_result.get("source") or result["source"]
            result["selenium_attempted"] = True
        except Exception:
            logger.debug("[REG:eROC] Selenium branch raised an exception, falling back to static request")

    # Fallback: attempt a static POST (usually only returns app shell)
    try:
        search_url = "https://eroc.drc.gov.lk/home/search"
        headers = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded"}
        payload = {"search": company_name}
        resp = requests.post(search_url, data=payload, headers=headers, timeout=min(8, REG_HTTP_TIMEOUT + 3))
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        rows = soup.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if cells and len(cells) >= 2:
                found_name = cells[0].get_text(strip=True).lower()
                if any(w in found_name for w in (company_name or "").lower().split() if len(w) > 3):
                    result["is_registered"] = True
                    result["reg_name"] = cells[0].get_text(strip=True)
                    result["reg_number"] = cells[1].get_text(strip=True) if len(cells) > 1 else None
                    logger.debug("[REG:eROC] Found match (static): %s", result)
                    return result
    except Exception as exc:
        logger.debug("[REG:eROC] Static lookup failed (expected for SPA): %s", str(exc)[:200])

    logger.debug("[REG:eROC] No results for %s", company_name)
    return result


def check_registration_status(company_name: str, website_url: str | None = None) -> dict:
    """
    Check if company is officially registered in Sri Lanka (CSE, BOI, CBSL, DRC).
    Tries user name plus brand/domain aliases (e.g. Arpico -> Richard Pieris PLC).
    Positive hits are cached longer; misses are cached briefly so fixes apply quickly.
    """
    from app.employer_verification_model.review_aggregator import normalize_company_name

    company_name = normalize_company_name(company_name)
    cache_key = f"{(company_name or '').strip().lower()}|{(_normalize_url(website_url) or '').lower()}"
    now = time.time()
    cached = _REG_RESULT_CACHE.get(cache_key)
    if cached is not None:
        ts, payload = cached
        status = (payload or {}).get("government_registration_status")
        ttl = _REG_RESULT_CACHE_TTL_SEC if status == "registered" else min(120.0, _REG_RESULT_CACHE_TTL_SEC)
        if (now - ts) < ttl:
            logger.info("[REG] cache hit for %r (status=%s)", company_name, status)
            return deepcopy(payload)

    results = _check_registration_status_uncached(company_name, website_url)
    _REG_RESULT_CACHE[cache_key] = (now, deepcopy(results))
    return results


def _check_registration_status_uncached(company_name: str, website_url: str | None = None) -> dict:
    """
    Check registration across ALL available sources and merge signals:
    known entities, CSE API, OpenCorporates, eROC, CBSL/BOI search.
    OpenCorporates is an extra source — it does not replace CSE/eROC/CBSL.
    """
    from concurrent.futures import ThreadPoolExecutor
    from app.employer_verification_model.company_aliases import resolve_lookup_names
    from app.employer_verification_model.known_registered import lookup_known_registered
    from app.employer_verification_model.slaasmb_lookup import lookup_slaasmb_sbe

    results = {
        "is_cse_listed": 0,
        "is_boi_registered": 0,
        "is_cbsl_licensed": 0,
        "is_drc_registered": 0,
        "is_ircsl_registered": 0,
        "is_slaasmb_registered": 0,
        "registration_sources": [],
        "registration_trace": _init_registration_trace(company_name, website_url),
    }

    lookup_names = resolve_lookup_names(company_name, website_url)
    names_for_rest = lookup_names[:2]
    primary = names_for_rest[0] if names_for_rest else company_name
    finance_like = _looks_like_regulated_finance(company_name) or any(
        _looks_like_regulated_finance(n) for n in names_for_rest
    )

    if len(lookup_names) > 1:
        _append_registration_trace(
            results["registration_trace"],
            0,
            "alias_resolver",
            "expanded",
            "Expanded brand/domain aliases for registry lookup",
            lookup_names=lookup_names,
        )

    # --- 1) Known curated entities (merge, do not stop) ---
    # Label methods as CSE/CBSL (not "known_entity") so the UI shows real registries.
    for lookup_name in lookup_names:
        known = lookup_known_registered(lookup_name)
        if not known:
            continue
        hit = dict(known)
        hit["matched_lookup_name"] = lookup_name
        if known.get("cse_registered_name"):
            hit["reg_name"] = known.get("cse_registered_name")

        method_labels: list[tuple[str, str]] = []
        if known.get("is_cse_listed"):
            method_labels.append(("cse_listing", "Colombo Stock Exchange (CSE)"))
        if known.get("is_cbsl_licensed"):
            method_labels.append(("cbsl_licence", "Central Bank of Sri Lanka (CBSL)"))
        if known.get("is_boi_registered"):
            method_labels.append(("boi_listing", "Board of Investment (BOI)"))
        if known.get("is_drc_registered"):
            method_labels.append(("drc_record", "DRC / eROC"))
        if not method_labels:
            method_labels.append(("registry_record", "Official Sri Lanka registry"))

        primary_method, primary_trace = method_labels[0]
        _merge_registry_hit(
            results,
            hit,
            method=primary_method,
            trace_source=primary_trace,
            detail="Confirmed against public CSE/CBSL (or related) registry records",
            step=1,
        )
        sources = results.setdefault("registration_sources", [])
        for method_name, _trace in method_labels[1:]:
            if method_name not in sources:
                sources.append(method_name)
        results["registration_method"] = "+".join(sources) if sources else primary_method
        logger.info("[REG] curated registry hit for %r via %r -> %s", company_name, lookup_name, sources)
        break

    # --- 1b) SLAASMB SBE public list (cached; merge, do not stop) ---
    if not results.get("is_slaasmb_registered"):
        slaasmb_hit = {}
        for lookup_name in lookup_names:
            slaasmb_hit = lookup_slaasmb_sbe(lookup_name)
            if slaasmb_hit:
                slaasmb_hit["matched_lookup_name"] = lookup_name
                slaasmb_hit["lookup_name"] = lookup_name
                break
        if slaasmb_hit:
            _merge_registry_hit(
                results,
                slaasmb_hit,
                method="slaasmb_sbe_list",
                trace_source="SLAASMB",
                detail="Matched SLAASMB Specified Business Enterprise (SBE) list",
                step=1,
            )
        else:
            _append_registration_trace(
                results["registration_trace"],
                1,
                "SLAASMB",
                "not_found",
                "No match on SLAASMB public SBE company list",
            )

    # --- 2) Fast parallel: CSE API + OpenCorporates (all lookup names, first hits merged) ---
    def _cse_any() -> dict:
        for lookup_name in lookup_names:
            try:
                cse = _check_cse_with_api(lookup_name)
                if cse.get("is_registered"):
                    return {
                        "is_registered": True,
                        "is_cse_listed": 1,
                        "reg_source": cse.get("source"),
                        "cse_symbol": cse.get("symbol"),
                        "cse_registered_name": cse.get("reg_name"),
                        "reg_name": cse.get("reg_name"),
                        "matched_lookup_name": lookup_name,
                        "symbol": cse.get("symbol"),
                    }
            except Exception:
                continue
        return {}

    def _oc_any() -> dict:
        if not OPEN_CORPORATES_API_TOKEN:
            return {}
        for lookup_name in names_for_rest:
            hit = _opencorporates_registration_lookup(lookup_name)
            if hit:
                hit["matched_lookup_name"] = lookup_name
                hit["lookup_name"] = lookup_name
                return hit
        return {}

    with ThreadPoolExecutor(max_workers=2) as pool:
        f_cse = pool.submit(_cse_any)
        f_oc = pool.submit(_oc_any)
        cse_hit = f_cse.result()
        oc_hit = f_oc.result()

    if cse_hit:
        _merge_registry_hit(
            results,
            cse_hit,
            method="cse_api",
            trace_source="Colombo Stock Exchange (CSE)",
            detail="CSE API confirmed a match",
            step=1,
        )
        logger.info("[REG:CSE] matched %r -> %s", company_name, cse_hit.get("reg_name"))
    else:
        _append_registration_trace(
            results["registration_trace"],
            1,
            "Colombo Stock Exchange (CSE)",
            "not_found",
            "No CSE API match for input name or aliases",
            lookup_names=lookup_names,
        )

    if oc_hit:
        _merge_registry_hit(
            results,
            oc_hit,
            method="opencorporates",
            trace_source="OpenCorporates",
            detail="OpenCorporates confirmed a company registry match",
            step=3,
        )
    else:
        _append_registration_trace(
            results["registration_trace"],
            3,
            "OpenCorporates",
            "skipped" if not OPEN_CORPORATES_API_TOKEN else "not_found",
            "OPEN_CORPORATES_API_TOKEN not configured"
            if not OPEN_CORPORATES_API_TOKEN
            else "OpenCorporates returned no Sri Lanka registry match",
        )

    already_strong = bool(
        results.get("is_cse_listed")
        or results.get("is_cbsl_licensed")
        or results.get("is_drc_registered")
        or results.get("is_boi_registered")
        or results.get("is_slaasmb_registered")
    )

    # --- 3) eROC (Selenium) — still try for non-banks if DRC not yet confirmed ---
    eroc_selenium_used = False
    if not results.get("is_drc_registered") and not finance_like:
        for idx, lookup_name in enumerate(names_for_rest):
            try:
                use_sel = USE_EROC_SELENIUM and idx == 0
                if use_sel:
                    eroc_selenium_used = True
                eroc = check_eroc_registration(lookup_name, use_selenium=use_sel)
                if eroc.get("is_registered"):
                    _merge_registry_hit(
                        results,
                        {
                            "is_drc_registered": 1,
                            "reg_number": eroc.get("reg_number"),
                            "reg_name": eroc.get("reg_name"),
                            "reg_source": eroc.get("source"),
                            "matched_lookup_name": lookup_name,
                            "lookup_name": lookup_name,
                        },
                        method="eroc_selenium" if use_sel else "eroc",
                        trace_source="eROC",
                        detail="Official eROC lookup confirmed a match"
                        + (" (Selenium)" if use_sel else ""),
                        step=2,
                    )
                    break
            except Exception:
                logger.debug("[REG] eROC lookup error for %s", lookup_name)
        if not results.get("is_drc_registered"):
            _append_registration_trace(
                results["registration_trace"],
                2,
                "eROC",
                "not_found",
                "No eROC match returned"
                + (" after Selenium attempt" if eroc_selenium_used else ""),
            )
    elif finance_like:
        _append_registration_trace(
            results["registration_trace"],
            2,
            "eROC",
            "skipped",
            "Skipped eROC for bank/finance entity (use CSE/CBSL/OpenCorporates)",
        )
    else:
        _append_registration_trace(
            results["registration_trace"],
            2,
            "eROC",
            "skipped",
            "Skipped eROC — DRC/OpenCorporates already confirmed",
        )

    # Optional CSE selenium (off by default)
    if USE_CSE_SELENIUM and not results.get("is_cse_listed"):
        try:
            cse = _check_cse_with_selenium(company_name, timeout=8)
            if cse.get("is_registered"):
                _merge_registry_hit(
                    results,
                    {
                        "is_registered": True,
                        "is_cse_listed": 1,
                        "reg_source": cse.get("source"),
                        "cse_symbol": cse.get("symbol"),
                        "cse_registered_name": cse.get("reg_name"),
                        "reg_name": cse.get("reg_name"),
                        "symbol": cse.get("symbol"),
                    },
                    method="cse_directory_selenium",
                    trace_source="Colombo Stock Exchange (CSE)",
                    detail="CSE listed-company directory confirmed a match",
                    step=1,
                )
        except Exception:
            pass

    # --- 4) Compact CBSL/CSE/BOI DDGS — always useful for banks; merge ---
    skip_heavy_search = eroc_selenium_used and SKIP_HEAVY_DDGS_AFTER_SELENIUM and not finance_like and already_strong

    need_more = not (
        results.get("is_cse_listed")
        or results.get("is_cbsl_licensed")
        or results.get("is_drc_registered")
        or results.get("is_boi_registered")
        or results.get("is_slaasmb_registered")
    )

    if need_more or finance_like:
        if not skip_heavy_search:
            sources = OFFICIAL_REGISTRY_SOURCES
            if finance_like:
                sources = [
                    s
                    for s in OFFICIAL_REGISTRY_SOURCES
                    if s[0]
                    in (
                        "is_cbsl_licensed",
                        "is_ircsl_registered",
                        "is_drc_registered",
                        "is_cse_listed",
                        "is_slaasmb_registered",
                    )
                ] or OFFICIAL_REGISTRY_SOURCES
            found_official = False
            for lookup_name in names_for_rest:
                for flag_name, source_name, domains in sources:
                    if source_name == "Colombo Stock Exchange (CSE)":
                        continue
                    if results.get(flag_name):
                        continue
                    official_match = _search_official_registry(lookup_name, domains)
                    if official_match:
                        _merge_registry_hit(
                            results,
                            {
                                flag_name: 1,
                                "reg_source": source_name,
                                "matched_lookup_name": lookup_name,
                                "lookup_name": lookup_name,
                            },
                            method=f"official_registry_search:{official_match.get('source', domains[0])}",
                            trace_source=source_name,
                            detail="Official registry search confirmed a match",
                            step=4,
                        )
                        found_official = True
                        break
                if found_official:
                    break
            if not found_official:
                _append_registration_trace(
                    results["registration_trace"],
                    4,
                    "official_search",
                    "not_found",
                    "No official registry web-search match",
                )
        else:
            _append_registration_trace(
                results["registration_trace"],
                4,
                "official_search",
                "skipped",
                "Skipped heavy search — already confirmed by other sources",
            )

    # Website heuristics: hint only — never set official registry flags from page text alone
    if website_url and need_more:
        page_text = _fetch_page(website_url, timeout=int(REG_HTTP_TIMEOUT)).lower()
        if any(
            k in page_text
            for k in [
                "registrar of companies",
                "registration no",
                "company registration",
                "reg no",
                "registered in sri lanka",
            ]
        ):
            if not any(
                results.get(k)
                for k in ("is_cse_listed", "is_cbsl_licensed", "is_boi_registered", "is_drc_registered")
            ):
                results["registration_method"] = "website_heuristics"
                _append_registration_trace(
                    results["registration_trace"],
                    5,
                    "website_heuristics",
                    "unverified",
                    "Website text mentioned a Sri Lanka registry keyword (not counted as official)",
                )

    # Compact DDGS CSE/CBSL/BOI — always run when still missing key flags
    if need_more or finance_like or not results.get("is_cbsl_licensed"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                from duckduckgo_search import DDGS

            ddgs_targets = [
                ("is_cbsl_licensed", "Central Bank of Sri Lanka (cbsl.gov.lk)", "cbsl.gov.lk", "DDGS:CBSL"),
                ("is_cse_listed", "Colombo Stock Exchange (cse.lk)", "cse.lk", "DDGS:CSE"),
                ("is_boi_registered", "Board of Investment (boi.lk)", "boi.lk", "DDGS:BOI"),
            ]
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                with DDGS() as ddgs_client:
                    for lookup_name in names_for_rest:
                        for flag, source, site, trace_name in ddgs_targets:
                            if results.get(flag):
                                continue
                            try:
                                r = list(ddgs_client.text(f'"{lookup_name}" site:{site}', max_results=3) or [])
                                if not r and finance_like and flag == "is_cbsl_licensed":
                                    r = list(
                                        ddgs_client.text(
                                            f'"{lookup_name}" licensed OR licence site:cbsl.gov.lk',
                                            max_results=3,
                                        )
                                        or []
                                    )
                                if r:
                                    _merge_registry_hit(
                                        results,
                                        {
                                            flag: 1,
                                            "reg_source": source,
                                            "matched_lookup_name": lookup_name,
                                            "lookup_name": lookup_name,
                                        },
                                        method="ddgs_fallback",
                                        trace_source=trace_name,
                                        detail=f"DuckDuckGo found a matching {site} result",
                                        step=6,
                                    )
                                    logger.info("[REG] compact DDGS hit %s for %r via %s", flag, lookup_name, site)
                            except Exception:
                                continue
        except Exception:
            logger.debug("[REG] DDGS search unavailable, skipping fallback")

    _apply_government_registration_verdict(results)
    # Prefer strongest human-readable source label
    if results.get("is_cse_listed") and not results.get("reg_source"):
        results["reg_source"] = "Colombo Stock Exchange (CSE)"
    elif results.get("is_cbsl_licensed") and not results.get("reg_source"):
        results["reg_source"] = "Central Bank of Sri Lanka (CBSL)"
    elif results.get("is_drc_registered") and not results.get("reg_source"):
        results["reg_source"] = results.get("reg_source") or "DRC / eROC / OpenCorporates"
    elif results.get("is_slaasmb_registered") and not results.get("reg_source"):
        results["reg_source"] = "SLAASMB Specified Business Enterprise (SBE) list"

    _append_registration_trace(
        results["registration_trace"],
        7,
        "final",
        results["government_registration_status"],
        "Final registration decision from merged sources: "
        + (", ".join(results.get("registration_sources") or []) or "none"),
        government_source=results.get("government_registration_source"),
        sources=results.get("registration_sources"),
    )
    logger.info(
        "[REG] final %s sources=%s cse=%s cbsl=%s drc=%s slaasmb=%s",
        results.get("government_registration_status"),
        results.get("registration_sources"),
        results.get("is_cse_listed"),
        results.get("is_cbsl_licensed"),
        results.get("is_drc_registered"),
        results.get("is_slaasmb_registered"),
    )
    return results


def check_professional_presence(company_name: str, website_url: str | None = None) -> dict:
    """
    Check for company presence on LinkedIn, topjobs.lk, glassdoor, indeed,
    review platforms, and social media using the shared review aggregator.
    """
    signals = aggregate_review_signals(company_name, website_url)
    return {
        "has_linkedin": signals.get("has_linkedin", 0),
        "has_topjobs": signals.get("has_topjobs_lk", 0),
        "has_topjobs_lk": signals.get("has_topjobs_lk", 0),
        "has_glassdoor": signals.get("has_glassdoor", 0),
        "has_indeed": signals.get("has_indeed", 0),
        "has_ftlk": signals.get("has_ft_lk", 0),
        "has_ft_lk": signals.get("has_ft_lk", 0),
        "has_adaderana": 0,
        "has_trustpilot": signals.get("has_trustpilot", 0),
        "has_sitejabber": signals.get("has_sitejabber", 0),
        "has_social_facebook": signals.get("has_social_facebook", 0),
        "has_social_instagram": signals.get("has_social_instagram", 0),
        "has_social_x": signals.get("has_social_x", 0),
        "has_social_youtube": signals.get("has_social_youtube", 0),
        "has_social_reddit": signals.get("has_social_reddit", 0),
        "has_website_reviews": signals.get("has_website_reviews", 0),
        "has_positive_reviews": signals.get("has_positive_reviews", 0),
        "has_negative_reviews": signals.get("has_negative_reviews", 0),
        "has_ikman_lk": signals.get("has_ikman_lk", 0),
        "social_only_presence": signals.get("social_only_presence", 0),
        "has_scam_report": signals.get("has_scam_report", 0),
    }
