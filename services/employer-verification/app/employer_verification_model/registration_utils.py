from __future__ import annotations

import base64
import logging
import os
import re
import warnings
from typing import Dict

import requests
from bs4 import BeautifulSoup

# Load .env file for environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Optional Selenium support for rendering JS-heavy eROC site
USE_EROC_SELENIUM = os.getenv("EROC_USE_SELENIUM", "0") == "1"
USE_CSE_SELENIUM = os.getenv("CSE_USE_SELENIUM", "1") == "1"
_CSE_ALL_SECURITY_CODE_URL = "https://www.cse.lk/api/allSecurityCode"
_CSE_API_KEY = os.getenv("CSE_API_KEY", "Cse123Api").strip()


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
    
    # Ensure URL has a scheme
    if not re.match(r'^[a-z]+://', url, re.IGNORECASE):
        url = 'http://' + url
    
    return url


def _check_eroc_with_selenium(company_name: str, timeout: int = 12) -> Dict[str, object]:
    """Attempt to render eROC with Selenium (headless Chrome) and extract results.

    This is opt-in and will silently return empty if Selenium or driver isn't available.
    Ensure `EROC_USE_SELENIUM=1` in the environment to enable.
    """
    result = {
        "is_registered": False,
        "reg_number": None,
        "reg_name": None,
        "source": "eROC - Department of Registrar of Companies (rendered)",
    }

    try:
        # Lazy imports so package is optional
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        # Try webdriver-manager if available to simplify driver installation
        try:
            from webdriver_manager.chrome import ChromeDriverManager
            driver_path = ChromeDriverManager().install()
            service = Service(driver_path)
        except Exception:
            # Fallback to system chromedriver in PATH
            service = None

        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--user-agent=Mozilla/5.0 (compatible; verifier/1.0)")

        if service is not None:
            driver = webdriver.Chrome(service=service, options=options)
        else:
            driver = webdriver.Chrome(options=options)

        try:
            driver.set_page_load_timeout(timeout)
            driver.get("https://eroc.drc.gov.lk/")

            wait = WebDriverWait(driver, timeout)

            # Try a few likely selectors for the search box/button used by the SPA
            search_el = None
            for sel in ["input[type='search']", "input[placeholder*='Search']", "input[placeholder*='Company']", "#search"]:
                try:
                    search_el = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, sel)))
                    if search_el:
                        break
                except Exception:
                    continue

            if not search_el:
                # Try any input element as last resort
                try:
                    search_el = wait.until(EC.presence_of_element_located((By.TAG_NAME, "input")))
                except Exception:
                    pass

            if not search_el:
                return result

            # Enter company name and submit
            try:
                search_el.clear()
            except Exception:
                pass
            search_el.send_keys(company_name)
            # Attempt to press enter via JS in case button isn't visible
            driver.execute_script("arguments[0].dispatchEvent(new KeyboardEvent('keydown',{'key':'Enter'}));", search_el)

            # Wait for results area to appear - common patterns include tables or divs
            try:
                wait.until(
                    EC.any_of(
                        EC.presence_of_element_located((By.TAG_NAME, "table")),
                        EC.presence_of_element_located((By.CSS_SELECTOR, ".search-results")),
                        EC.presence_of_element_located((By.CSS_SELECTOR, ".result")),
                    )
                )
            except Exception:
                # proceed to parse whatever is rendered after a short sleep
                pass

            page = driver.page_source
            soup = BeautifulSoup(page, "html.parser")

            # Try to parse table rows first
            rows = soup.find_all("tr")
            for row in rows:
                cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
                if not cells:
                    continue
                joined = " ".join(cells).lower()
                if any(tok in joined for tok in [w for w in company_name.lower().split() if len(w) > 3]):
                    result["is_registered"] = True
                    # heuristics: first cell name, second maybe reg no
                    result["reg_name"] = cells[0]
                    if len(cells) > 1:
                        result["reg_number"] = cells[1]
                    return result

            # Fallback: look for divs/spans that contain registration keywords
            candidates = soup.find_all(string=lambda s: s and any(k in s.lower() for k in ["registrar of companies", "registration no", "reg no", "registration number"]))
            for c in candidates:
                parent = c.parent
                text = parent.get_text(" ", strip=True)
                if any(tok in text.lower() for tok in [w for w in company_name.lower().split() if len(w) > 3]):
                    result["is_registered"] = True
                    # try to extract reg number via regex
                    import re

                    m = re.search(r"(reg(istration)?\s*(no|number)[:\s]*([A-Za-z0-9\-\/]+))", text, re.I)
                    if m:
                        result["reg_number"] = m.group(4)
                    # attempt to set reg_name as nearby heading
                    heading = parent.find_previous(["h1", "h2", "h3"]) or parent.find_previous("strong")
                    if heading:
                        result["reg_name"] = heading.get_text(strip=True)
                    return result

            return result
        finally:
            try:
                driver.quit()
            except Exception:
                pass
    except Exception as exc:
        logger.debug("[REG:eROC:Selenium] Selenium attempt failed or not available: %s", str(exc)[:200])
        return result


def _check_cse_with_selenium(company_name: str, timeout: int = 12) -> Dict[str, object]:
    """Search the CSE listed-company directory using Selenium.

    The CSE directory is JavaScript-driven and exposes a client-side search box.
    This helper loads the directory, filters by company name, and extracts the
    matching row or company profile link.
    """
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
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        try:
            from webdriver_manager.chrome import ChromeDriverManager

            driver_path = ChromeDriverManager().install()
            service = Service(driver_path)
        except Exception:
            service = None

        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--user-agent=Mozilla/5.0 (compatible; verifier/1.0)")

        driver = webdriver.Chrome(service=service, options=options) if service is not None else webdriver.Chrome(options=options)
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

            # If the body shows the company-profile table but the exact company is not visible,
            # keep the result as not registered for this lookup.

            return result
        finally:
            try:
                driver.quit()
            except Exception:
                pass
    except Exception as exc:
        logger.debug("[REG:CSE:Selenium] Selenium attempt failed or not available: %s", str(exc)[:200])
        return result


def _check_cse_with_api(company_name: str, timeout: int = 12) -> Dict[str, object]:
    """Query the CSE listed-company API directly and match the returned listings."""
    result = {
        "is_registered": False,
        "symbol": None,
        "reg_name": None,
        "source": "Colombo Stock Exchange (CSE) API",
    }

    if not company_name:
        return result

    try:
        api_key = base64.b64encode(_CSE_API_KEY.encode("utf-8")).decode("ascii")
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; verifier/1.0)",
            "x-api-key": api_key,
        }
        response = requests.get(_CSE_ALL_SECURITY_CODE_URL, headers=headers, timeout=timeout)
        response.raise_for_status()
        payload = response.json()
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
                continue

        result["is_registered"] = True
        result["symbol"] = symbol or None
        result["reg_name"] = name
        return result

    logger.debug("[REG:CSE:API] No direct name match found for %s using tokens=%s", company_name, search_tokens)
    return result


from app.employer_verification_model.review_aggregator import aggregate_review_signals

logger = logging.getLogger(__name__)

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


def _opencorporates_registration_lookup(company_name: str) -> Dict[str, int]:
    """Use OpenCorporates API when a token is available."""
    if not OPEN_CORPORATES_API_TOKEN:
        logger.debug("[REG] OpenCorporates API token not configured")
        return {}

    params = {
        "q": company_name,
        "per_page": 10,
        "normalise_company_name": "true",
        "api_token": OPEN_CORPORATES_API_TOKEN,
    }

    try:
        response = requests.get(OPEN_CORPORATES_API_URL, params=params, timeout=8)
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        logger.debug("[REG] OpenCorporates lookup failed for %s: %s", company_name, str(exc)[:160])
        return {}

    results = payload.get("results", {}).get("companies", []) or []
    if not results:
        logger.debug("[REG] OpenCorporates returned no matches for %s", company_name)
        return {}

    normalized_name = _normalize_company(company_name)
    for item in results:
        company = item.get("company", {})
        name = _normalize_company(company.get("name", ""))
        registry_url = (company.get("registry_url") or "").lower()
        source = company.get("source") or {}
        source_url = (source.get("url") or "").lower()
        publisher = (source.get("publisher") or "").lower()
        jurisdiction = (company.get("jurisdiction_code") or "").lower()
        text = " ".join([name, registry_url, source_url, publisher, jurisdiction])

        if normalized_name and normalized_name not in name:
            continue

        result = {
            "is_cse_listed": int("cse" in text or "stock exchange" in text),
            "is_boi_registered": int("boi" in text or "board of investment" in text),
            "is_cbsl_licensed": int("cbsl" in text or "central bank" in text),
            "is_drc_registered": int(jurisdiction == "lk" or "sri lanka" in text or "registrar of companies" in text),
        }

        if any(result.values()):
            logger.debug("[REG] OpenCorporates matched %s -> %s", normalized_name, result)
            return result

    logger.debug("[REG] OpenCorporates found a name match for %s but no registry signals", company_name)
    return {}


def _apply_government_registration_verdict(result: dict) -> dict:
    official_sources = []
    if result.get("is_drc_registered"):
        official_sources.append("DRC / eROC")
    if result.get("is_boi_registered"):
        official_sources.append("BOI")
    if result.get("is_cse_listed"):
        official_sources.append("CSE")
    if result.get("is_cbsl_licensed"):
        official_sources.append("CBSL")
    if result.get("is_ircsl_registered"):
        official_sources.append("IRCSL")
    if result.get("is_slaasmb_registered"):
        official_sources.append("SLAASMB")

    if official_sources:
        result["government_registration_status"] = "registered"
        result["government_registration_source"] = ", ".join(official_sources)
        result["is_government_registered"] = 1
    else:
        result["is_government_registered"] = 0
        result["government_registration_source"] = None
        if result.get("registration_method") in {"website_heuristics", "ddgs_fallback"}:
            result["government_registration_status"] = "unverified"
        else:
            result["government_registration_status"] = "not_found"

    return result


def check_eroc_registration(company_name: str) -> Dict[str, object]:
    """
    Query Sri Lanka's official eROC (DRC) search and return registration details.
    Note: eROC is a JavaScript SPA that requires browser rendering for full functionality.
    Static HTTP requests return the app shell without results.
    Future: integrate Selenium or use eROC API when available.
    Returns a dict with boolean flag `is_registered` and optional `reg_number` and `reg_name`.
    """
    result = {
        "is_registered": False,
        "reg_number": None,
        "reg_name": None,
        "source": "eROC - Department of Registrar of Companies",
    }

    # If enabled, try Selenium-based rendering first for SPA results
    if USE_EROC_SELENIUM:
        try:
            selenium_result = _check_eroc_with_selenium(company_name)
            if selenium_result.get("is_registered"):
                return selenium_result
        except Exception:
            logger.debug("[REG:eROC] Selenium branch raised an exception, falling back to static request")

    # Fallback: attempt a static POST (usually only returns app shell)
    try:
        search_url = "https://eroc.drc.gov.lk/home/search"
        headers = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded"}
        payload = {"search": company_name}
        resp = requests.post(search_url, data=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Try to find table rows that contain results
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

    logger.debug("[REG:eROC] No results (static lookup skipped for SPA)")
    return result


def check_registration_status(company_name: str, website_url: str | None = None) -> dict:
    """
    Check if company is officially registered in Sri Lanka (CSE, BOI, CBSL, DRC).
    Tries in order: eROC → OpenCorporates → website heuristics → DDGS fallback
    """
    results = {
        "is_cse_listed": 0,
        "is_boi_registered": 0,
        "is_cbsl_licensed": 0,
        "is_drc_registered": 0,
        "is_ircsl_registered": 0,
        "is_slaasmb_registered": 0,
        "registration_trace": _init_registration_trace(company_name, website_url),
    }

    # 0) Try official eROC first (best source, though may not work due to SPA)
    try:
        eroc = check_eroc_registration(company_name)
        if eroc.get("is_registered"):
            results["is_drc_registered"] = 1
            results["reg_number"] = eroc.get("reg_number")
            results["reg_name"] = eroc.get("reg_name")
            results["reg_source"] = eroc.get("source")
            results["registration_method"] = "eroc"
            _apply_government_registration_verdict(results)
            _append_registration_trace(results["registration_trace"], 1, "eROC", "registered", "Official eROC lookup confirmed a match", reg_number=results.get("reg_number"), reg_name=results.get("reg_name"))
            logger.debug("[REG:eROC] Found official registration for %s -> %s", company_name, eroc)
            return results
        _append_registration_trace(results["registration_trace"], 1, "eROC", "not_found", "No eROC match returned")
    except Exception:
        _append_registration_trace(results["registration_trace"], 1, "eROC", "error", "eROC lookup raised an exception")
        logger.debug("[REG] eROC lookup error for %s", company_name)

    # 1) Prefer authoritative OpenCorporates when a token is configured
    api_results = _opencorporates_registration_lookup(company_name)
    if api_results:
        results.update(api_results)
        results["registration_method"] = "opencorporates"
        _apply_government_registration_verdict(results)
        _append_registration_trace(results["registration_trace"], 2, "OpenCorporates", "registered" if any(api_results.values()) else "not_found", "OpenCorporates lookup returned official registry signals" if any(api_results.values()) else "OpenCorporates returned no registry signals", signals=api_results)
        return results
    _append_registration_trace(results["registration_trace"], 2, "OpenCorporates", "not_found", "OpenCorporates returned no registry signals")

    # 2) Prefer the direct CSE API, then fall back to Selenium if needed.
    if not results.get("is_cse_listed"):
        try:
            cse = _check_cse_with_api(company_name)
            if cse.get("is_registered"):
                results["is_cse_listed"] = 1
                results["reg_source"] = cse.get("source")
                results["registration_method"] = "cse_api"
                results["cse_symbol"] = cse.get("symbol")
                results["cse_registered_name"] = cse.get("reg_name")
                _apply_government_registration_verdict(results)
                _append_registration_trace(results["registration_trace"], 3, "Colombo Stock Exchange (CSE)", "registered", "CSE API confirmed a match", symbol=cse.get("symbol"), reg_name=cse.get("reg_name"))
                logger.debug("[REG:CSE] Found CSE listing via API for %s -> %s", company_name, cse)
                return results
            _append_registration_trace(results["registration_trace"], 3, "Colombo Stock Exchange (CSE)", "not_found", "No CSE API match found")
        except Exception:
            _append_registration_trace(results["registration_trace"], 3, "Colombo Stock Exchange (CSE)", "error", "CSE API lookup raised an exception")

        if USE_CSE_SELENIUM and not results.get("is_cse_listed"):
            try:
                cse = _check_cse_with_selenium(company_name)
                if cse.get("is_registered"):
                    results["is_cse_listed"] = 1
                    results["reg_source"] = cse.get("source")
                    results["registration_method"] = "cse_directory_selenium"
                    results["cse_symbol"] = cse.get("symbol")
                    results["cse_registered_name"] = cse.get("reg_name")
                    _apply_government_registration_verdict(results)
                    _append_registration_trace(results["registration_trace"], 3, "Colombo Stock Exchange (CSE)", "registered", "CSE listed-company directory confirmed a match", symbol=cse.get("symbol"), reg_name=cse.get("reg_name"))
                    logger.debug("[REG:CSE] Found CSE listing via Selenium for %s -> %s", company_name, cse)
                    return results
            except Exception:
                _append_registration_trace(results["registration_trace"], 3, "Colombo Stock Exchange (CSE)", "error", "CSE directory lookup raised an exception")

    # 3) Probe the remaining official Sri Lankan registry domains directly via search.
    for flag_name, source_name, domains in OFFICIAL_REGISTRY_SOURCES:
        if source_name == "Colombo Stock Exchange (CSE)":
            continue
        if results.get(flag_name):
            continue
        official_match = _search_official_registry(company_name, domains)
        if official_match:
            results[flag_name] = 1
            results["reg_source"] = source_name
            results["registration_method"] = f"official_registry_search:{official_match.get('source', domains[0])}"
            results["official_registry_query"] = official_match.get("query")
            results["official_registry_match"] = official_match.get("match")
            _apply_government_registration_verdict(results)
            _append_registration_trace(results["registration_trace"], 3, source_name, "registered", "Official registry search confirmed a match", query=official_match.get("query"), domain=official_match.get("source", domains[0]))
            logger.debug("[REG:official-search] Found %s for %s via %s", source_name, company_name, official_match.get("source"))
            return results
        _append_registration_trace(results["registration_trace"], 3, source_name, "not_found", "No official registry match found", domains=domains)

    # 3) If official registry search returned nothing and we have a website,
    # use simple heuristics on the site's text to detect local registry mentions.
    if website_url:
        page_text = _fetch_page(website_url, timeout=6).lower()

        # Registrar of Companies / DRC signals
        if any(k in page_text for k in ["registrar of companies", "registration no", "company registration", "reg no", "registered in sri lanka"]):
            results["is_drc_registered"] = 1

        # Colombo Stock Exchange (CSE)
        if any(k in page_text for k in ["colombo stock exchange", "cse", "stock exchange"]):
            results["is_cse_listed"] = 1

        # Board of Investment
        if any(k in page_text for k in ["board of investment", "boi", "board of investment of sri lanka"]):
            results["is_boi_registered"] = 1

        # Central Bank licensing
        if any(k in page_text for k in ["central bank", "cbsl", "central bank of sri lanka"]):
            results["is_cbsl_licensed"] = 1

        # Insurance regulator
        if any(k in page_text for k in ["insurance regulatory commission", "ircsl", "insurance board of sri lanka"]):
            results["is_ircsl_registered"] = 1

        # Accounting/auditing standards board
        if any(k in page_text for k in ["slaasmb", "accounting and auditing standards monitoring board", "specified business enterprise"]):
            results["is_slaasmb_registered"] = 1

        if any(results.values()):
            results["registration_method"] = "website_heuristics"
            _apply_government_registration_verdict(results)
            _append_registration_trace(results["registration_trace"], 4, "website_heuristics", "unverified", "Website text mentioned a Sri Lanka registry keyword, but no official source was confirmed")
            logger.debug("[REG:web-heuristics] Website heuristics matched for %s -> %s", company_name, results)
            return results
        _append_registration_trace(results["registration_trace"], 4, "website_heuristics", "not_found", "Website check did not show official registry keywords")

    # 4) Fallback: try CSE/BOI via DuckDuckGo (DDGS) search if available
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            from duckduckgo_search import DDGS

        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            with DDGS() as ddgs_client:
                # CSE
                try:
                    r = ddgs_client.text(f'"{company_name}" site:cse.lk', max_results=3)
                    if r:
                        results["is_cse_listed"] = 1
                        results["reg_source"] = "Colombo Stock Exchange (cse.lk)"
                        results["registration_method"] = "ddgs_fallback"
                        _apply_government_registration_verdict(results)
                        _append_registration_trace(results["registration_trace"], 5, "DDGS:CSE", "registered", "DuckDuckGo found a matching CSE result")
                        logger.debug("[REG:DDGS] Found CSE mention for %s", company_name)
                        return results
                except Exception:
                    pass

                # BOI
                try:
                    r = ddgs_client.text(f'"{company_name}" site:boi.lk', max_results=3)
                    if r:
                        results["is_boi_registered"] = 1
                        results["reg_source"] = "Board of Investment (boi.lk)"
                        results["registration_method"] = "ddgs_fallback"
                        _apply_government_registration_verdict(results)
                        _append_registration_trace(results["registration_trace"], 5, "DDGS:BOI", "registered", "DuckDuckGo found a matching BOI result")
                        logger.debug("[REG:DDGS] Found BOI mention for %s", company_name)
                        return results
                except Exception:
                    pass

                # CBSL
                try:
                    r = ddgs_client.text(f'"{company_name}" site:cbsl.gov.lk', max_results=3)
                    if r:
                        results["is_cbsl_licensed"] = 1
                        results["reg_source"] = "Central Bank of Sri Lanka (cbsl.gov.lk)"
                        results["registration_method"] = "ddgs_fallback"
                        _apply_government_registration_verdict(results)
                        _append_registration_trace(results["registration_trace"], 5, "DDGS:CBSL", "registered", "DuckDuckGo found a matching CBSL result")
                        logger.debug("[REG:DDGS] Found CBSL mention for %s", company_name)
                        return results
                except Exception:
                    pass

                # IRCSL
                try:
                    r = ddgs_client.text(f'"{company_name}" site:ircsl.gov.lk', max_results=3)
                    if r:
                        results["is_ircsl_registered"] = 1
                        results["reg_source"] = "Insurance Regulatory Commission of Sri Lanka (ircsl.gov.lk)"
                        results["registration_method"] = "ddgs_fallback"
                        _apply_government_registration_verdict(results)
                        _append_registration_trace(results["registration_trace"], 5, "DDGS:IRCSL", "registered", "DuckDuckGo found a matching IRCSL result")
                        logger.debug("[REG:DDGS] Found IRCSL mention for %s", company_name)
                        return results
                except Exception:
                    pass

                # SLAASMB
                try:
                    r = ddgs_client.text(f'"{company_name}" site:slaasmb.gov.lk', max_results=3)
                    if r:
                        results["is_slaasmb_registered"] = 1
                        results["reg_source"] = "SLAASMB (slaasmb.gov.lk)"
                        results["registration_method"] = "ddgs_fallback"
                        _apply_government_registration_verdict(results)
                        _append_registration_trace(results["registration_trace"], 5, "DDGS:SLAASMB", "registered", "DuckDuckGo found a matching SLAASMB result")
                        logger.debug("[REG:DDGS] Found SLAASMB mention for %s", company_name)
                        return results
                except Exception:
                    pass
    except Exception:
        logger.debug("[REG] DDGS search unavailable, skipping CSE/BOI fallback")

    if not any(results.values()):
        logger.debug("[REG] No registration signal found for %s", company_name)

    _apply_government_registration_verdict(results)
    _append_registration_trace(results["registration_trace"], 6, "final", results["government_registration_status"], "Final registration decision computed", government_source=results.get("government_registration_source"))

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
        "has_glassdoor": signals.get("has_glassdoor", 0),
        "has_indeed": signals.get("has_indeed", 0),
        "has_ftlk": signals.get("has_ft_lk", 0),
        "has_adaderana": 0,
        "has_trustpilot": signals.get("has_trustpilot", 0),
        "has_sitejabber": signals.get("has_sitejabber", 0),
        "has_social_facebook": signals.get("has_social_facebook", 0),
        "has_social_instagram": signals.get("has_social_instagram", 0),
        "has_social_x": signals.get("has_social_x", 0),
        "has_social_youtube": signals.get("has_social_youtube", 0),
        "has_social_reddit": signals.get("has_social_reddit", 0),
        "has_website_reviews": signals.get("has_website_reviews", 0),
        "has_scam_report": 0,
    }
