import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup

SCAM_KEYWORDS = [
    "urgent", "apply now", "limited time",
    "registration fee", "payment required",
    "bitcoin", "crypto", "wire transfer",
    "guaranteed job", "no experience needed",
    "earn money fast", "work from home easily"
]

USE_HEADLESS_FALLBACK = os.getenv("WEBSITE_USE_HEADLESS", "0") == "1"
HTTP_TIMEOUT = float(os.getenv("WEBSITE_HTTP_TIMEOUT", "5"))
PROBE_TIMEOUT = float(os.getenv("WEBSITE_PROBE_TIMEOUT", "3"))

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def normalize_website_url(url: str | None) -> str | None:
    """Ensure URLs have a scheme so requests.get does not fail."""
    if not url:
        return None
    u = str(url).strip()
    if not u:
        return None
    u = re.sub(r"^([a-z]+);/?/?", r"\1://", u, flags=re.IGNORECASE)
    if not re.match(r"^[a-z][a-z0-9+.-]*://", u, re.IGNORECASE):
        u = "https://" + u
    return u


_ABOUT_HREF = re.compile(r"(about|who[-_ ]?we[-_ ]?are|our[-_ ]?story|company[-_ ]?profile)", re.I)
_CONTACT_HREF = re.compile(r"(contact|get[-_ ]?in[-_ ]?touch|support|reach[-_ ]?us)", re.I)
_PRIVACY_HREF = re.compile(r"(privacy|data[-_ ]?protection|cookie)", re.I)
_TERMS_HREF = re.compile(r"(terms|conditions|tos|legal|t&c)", re.I)

_COMMON_PATHS = {
    "has_about": ["/about", "/about-us", "/aboutus", "/company", "/who-we-are"],
    "has_contact": ["/contact", "/contact-us", "/contactus", "/support"],
    "has_privacy_policy": ["/privacy", "/privacy-policy", "/privacy_policy", "/legal/privacy"],
    "has_terms": ["/terms", "/terms-of-service", "/terms-and-conditions", "/legal/terms"],
}


def _extract_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True).lower()


def page_signals_from_html(html: str) -> dict:
    """Detect about/contact/privacy/terms from visible text AND link hrefs."""
    soup = BeautifulSoup(html or "", "html.parser")
    hrefs = []
    link_text = []
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip().lower()
        label = a.get_text(" ", strip=True).lower()
        if href:
            hrefs.append(href)
        if label:
            link_text.append(label)
    href_blob = " ".join(hrefs)
    label_blob = " ".join(link_text)
    text = _extract_text(soup)

    has_about = int(
        bool(_ABOUT_HREF.search(href_blob))
        or "about us" in text
        or "about us" in label_blob
        or "who we are" in text
        or "about" in label_blob
    )
    has_contact = int(
        bool(_CONTACT_HREF.search(href_blob))
        or "mailto:" in href_blob
        or "contact us" in text
        or "contact us" in label_blob
        or "contact" in label_blob
        or "get in touch" in text
    )
    has_privacy = int(
        bool(_PRIVACY_HREF.search(href_blob))
        or "privacy policy" in text
        or "privacy policy" in label_blob
        or "privacy" in label_blob
    )
    has_terms = int(
        bool(_TERMS_HREF.search(href_blob))
        or "terms and conditions" in text
        or "terms of service" in text
        or "terms of use" in text
        or "terms" in label_blob
    )

    return {
        "has_about": has_about,
        "has_contact": has_contact,
        "has_privacy_policy": has_privacy,
        "has_terms": has_terms,
        "text": text,
        "html_len": len(html or ""),
        "link_count": len(hrefs),
    }


def _probe_path(base_url: str, path: str) -> bool:
    """Return True if a common subpage responds with real content."""
    try:
        target = urljoin(base_url if base_url.endswith("/") else base_url + "/", path.lstrip("/"))
        r = requests.get(target, timeout=PROBE_TIMEOUT, headers=_BROWSER_HEADERS, allow_redirects=True)
        if r.status_code >= 400:
            return False
        # Avoid counting soft-404 homepages that always return 200
        body = (r.text or "").lower()
        if len(body) < 200:
            return False
        leaf = path.strip("/").split("/")[-1].replace("-", " ")
        return leaf.split()[0] in body or path.strip("/").split("/")[-1] in (r.url or "").lower()
    except Exception:
        return False


def enrich_signals_with_path_probes(base_url: str, signals: dict) -> dict:
    """
    If homepage missed About/Contact/Privacy/Terms, quickly probe common URLs.
    Runs in parallel; keeps total extra wait small.
    """
    missing = [k for k, paths in _COMMON_PATHS.items() if not signals.get(k)]
    if not missing:
        return signals

    out = dict(signals)

    def _job(flag: str, path: str):
        return flag, path, _probe_path(base_url, path)

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [
            pool.submit(_job, flag, path)
            for flag in missing
            for path in _COMMON_PATHS[flag]
        ]
        for fut in as_completed(futures):
            try:
                flag, _path, ok = fut.result()
            except Exception:
                continue
            if ok:
                out[flag] = 1
    return out


def fetch_website_bundle(url: str) -> dict:
    """
    Fetch homepage HTML once; return text + page signals.
    Falls back to optional headless only when HTML/text is almost empty.
    """
    url = normalize_website_url(url) or url
    html = ""
    text = ""
    signals = {
        "has_about": 0,
        "has_contact": 0,
        "has_privacy_policy": 0,
        "has_terms": 0,
        "text": "",
        "html_len": 0,
        "link_count": 0,
    }

    try:
        r = requests.get(url, timeout=HTTP_TIMEOUT, headers=_BROWSER_HEADERS, allow_redirects=True)
        r.raise_for_status()
        html = r.text or ""
        signals = page_signals_from_html(html)
        text = signals.get("text") or ""
        print(
            f"[DEBUG] HTTP scrape ok for {url} "
            f"(text_len={len(text)}, html_len={len(html)}, links={signals.get('link_count', 0)})"
        )
    except Exception as e:
        print(f"[DEBUG] HTTP scrape failed for {url}: {e}")

    # JS-heavy sites often return tiny visible text but still have footer links in HTML
    thin_text = len(text) < 80
    if thin_text and USE_HEADLESS_FALLBACK:
        try:
            print(f"[DEBUG] Headless fallback for: {url}")
            from .headless_utils import get_website_text_headless

            text = get_website_text_headless(url, wait_time=2) or text
            print(f"[DEBUG] Headless extracted len={len(text)}")
            if text and not html:
                signals = page_signals_from_html(f"<html><body>{text}</body></html>")
                signals["text"] = text
        except Exception as e:
            print(f"[ERROR] Headless fallback failed: {e}")

    # Probe common paths for any still-missing legal/nav pages (fast, parallel)
    try:
        signals = enrich_signals_with_path_probes(url, signals)
    except Exception as e:
        print(f"[DEBUG] path probe skipped: {e}")

    signals["text"] = text or signals.get("text") or ""
    return {"html": html, "text": signals["text"], "signals": signals}


def get_website_text(url: str) -> str:
    """Fast HTTP scrape first; optional headless fallback."""
    return fetch_website_bundle(url)["text"]


def check_page_exists(url, keyword):
    print(f"[DEBUG] Checking for page '{keyword}' in {url}")
    try:
        r = requests.get(url, timeout=HTTP_TIMEOUT, headers=_BROWSER_HEADERS)
    except Exception as e:
        print(f"[ERROR] Network error when fetching {url}: {e}")
        raise

    signals = page_signals_from_html(r.text)
    key = {
        "about": "has_about",
        "contact": "has_contact",
        "privacy": "has_privacy_policy",
        "terms": "has_terms",
    }.get(keyword.lower(), "")
    return int(signals.get(key, 0)) if key else 0


def extract_features(df):
    df["domain"] = df["website_url"].apply(lambda x: urlparse(x).netloc)
    df["domain_length"] = df["domain"].apply(len)
    df["subdomain_count"] = df["domain"].str.count(r"\.")
    df["has_about"] = df["website_url"].apply(lambda x: check_page_exists(x, "about"))
    df["has_contact"] = df["website_url"].apply(lambda x: check_page_exists(x, "contact"))
    df["content_length"] = df["website_url"].apply(lambda x: len(get_website_text(x)))
    df["scam_score"] = df["website_url"].apply(
        lambda x: scam_keyword_score(get_website_text(x))
    )
    return df


def scam_keyword_score(text):
    try:
        text = text.lower()
        return sum(1 for word in SCAM_KEYWORDS if word in text)
    except Exception:
        return 0


if __name__ == "__main__":
    df = pd.read_csv("data/final_merged_company_dataset.csv")
    df = extract_features(df)
    df.to_csv("data/feature_dataset.csv", index=False)
    print("Feature engineering completed!")
