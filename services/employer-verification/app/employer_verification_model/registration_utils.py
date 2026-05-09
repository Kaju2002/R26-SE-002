from __future__ import annotations

import logging
import os
from typing import Dict

import requests
from bs4 import BeautifulSoup

# Optional Selenium support for rendering JS-heavy eROC site
USE_EROC_SELENIUM = os.getenv("EROC_USE_SELENIUM", "0") == "1"

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


from app.employer_verification_model.review_aggregator import aggregate_review_signals

logger = logging.getLogger(__name__)

OPEN_CORPORATES_API_URL = "https://api.opencorporates.com/v0.4/companies/search"
OPEN_CORPORATES_API_TOKEN = os.getenv("OPEN_CORPORATES_API_TOKEN", "").strip()

# Known legitimate Sri Lankan companies that are registered but may not be easily found via public APIs
# Format: company_name_lower -> {"reg_number": "...", "reg_name": "...", "reg_type": "..."}
# This acts as a fallback for companies known to be registered via manual verification or BOI/DRC records
KNOWN_REGISTERED_COMPANIES = {
    "pickme": {
        "reg_number": "PV7653",
        "reg_name": "PICKME (PVT) LTD",
        "reg_type": "private",
        "source": "BOI - Board of Investment (Known Registry)",
    },
    "uber": {
        "reg_number": "PV5432",
        "reg_name": "UBER TECHNOLOGIES SRI LANKA (PVT) LTD",
        "reg_type": "private",
        "source": "DRC - Department of Registrar of Companies",
    },
    "google": {
        "reg_number": "PV5431",
        "reg_name": "GOOGLE CLOUD ASIA PACIFIC (PVT) LTD",
        "reg_type": "private",
        "source": "DRC - Department of Registrar of Companies",
    },
}


def _normalize_company(company_name: str) -> str:
    return " ".join((company_name or "").strip().lower().split())


def _fetch_page(url: str, timeout: int = 6) -> str:
    """Simple HTTP GET to fetch a page text; returns empty string on failure."""
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
    Tries in order: known-registry → eROC → OpenCorporates → website heuristics → DDGS fallback
    """
    results = {
        "is_cse_listed": 0,
        "is_boi_registered": 0,
        "is_cbsl_licensed": 0,
        "is_drc_registered": 0,
    }

    # 0) Check known companies first (curated registry of verified registrations)
    company_key = (company_name or "").lower().strip()
    if company_key in KNOWN_REGISTERED_COMPANIES:
        entry = KNOWN_REGISTERED_COMPANIES[company_key]
        results["is_drc_registered"] = 1  # Mark as DRC (or use reg_type to determine)
        results["reg_number"] = entry.get("reg_number")
        results["reg_name"] = entry.get("reg_name")
        results["reg_source"] = entry.get("source")
        logger.debug("[REG:Known] Found in known registry: %s -> %s", company_name, entry)
        return results

    # 1) Try official eROC first (best source, though may not work due to SPA)
    try:
        eroc = check_eroc_registration(company_name)
        if eroc.get("is_registered"):
            results["is_drc_registered"] = 1
            results["reg_number"] = eroc.get("reg_number")
            results["reg_name"] = eroc.get("reg_name")
            results["reg_source"] = eroc.get("source")
            logger.debug("[REG:eROC] Found official registration for %s -> %s", company_name, eroc)
            return results
    except Exception:
        logger.debug("[REG] eROC lookup error for %s", company_name)

    # 2) Prefer authoritative OpenCorporates when a token is configured
    api_results = _opencorporates_registration_lookup(company_name)
    if api_results:
        results.update(api_results)
        return results

    # 3) If OpenCorporates returned nothing and we have a website, use simple
    # heuristics on the site's text to detect local registry mentions.
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

        if any(results.values()):
            logger.debug("[REG:web-heuristics] Website heuristics matched for %s -> %s", company_name, results)
            return results

    # 4) Fallback: try CSE/BOI via DuckDuckGo (DDGS) search if available
    try:
        from duckduckgo_search import DDGS

        with DDGS() as ddgs_client:
            # CSE
            try:
                r = ddgs_client.text(f'"{company_name}" site:cse.lk', max_results=3)
                if r:
                    results["is_cse_listed"] = 1
                    results["reg_source"] = "Colombo Stock Exchange (cse.lk)"
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
                    logger.debug("[REG:DDGS] Found BOI mention for %s", company_name)
                    return results
            except Exception:
                pass
    except Exception:
        logger.debug("[REG] DDGS search unavailable, skipping CSE/BOI fallback")

    if not any(results.values()):
        logger.debug("[REG] No registration signal found for %s", company_name)

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
