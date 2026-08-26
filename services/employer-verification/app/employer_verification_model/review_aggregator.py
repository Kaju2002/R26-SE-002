from __future__ import annotations

import logging
import os
import re
import time
from copy import deepcopy
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote_plus, urljoin, urlparse

import requests

logger = logging.getLogger(__name__)

_REP_RESULT_CACHE: dict[str, tuple[float, dict]] = {}
_REP_RESULT_CACHE_TTL_SEC = float(os.getenv("REP_RESULT_CACHE_TTL_SEC", "1800"))

_SOCIAL_AND_REVIEW_KEYS = [
    "has_glassdoor",
    "has_indeed",
    "has_linkedin",
    "has_topjobs_lk",
    "has_ft_lk",
    "has_trustpilot",
    "has_sitejabber",
    "has_social_facebook",
    "has_social_instagram",
    "has_social_x",
    "has_social_youtube",
    "has_social_reddit",
    "has_website_reviews",
    "has_positive_reviews",
    "has_negative_reviews",
    "has_scam_report",
    "has_ikman_lk",
    "social_only_presence",
]

_PROFILE_MATCHERS = {
    "has_glassdoor": ["glassdoor.com"],
    "has_indeed": ["indeed.com"],
    "has_linkedin": [
        "linkedin.com/company",
        "linkedin.com/school",
        "linkedin.com/showcase",
        "linkedin.com/in/",
    ],
    "has_topjobs_lk": ["topjobs.lk"],
    "has_ft_lk": ["ft.lk"],
    "has_trustpilot": ["trustpilot.com"],
    "has_sitejabber": ["sitejabber.com"],
    "has_social_facebook": ["facebook.com", "fb.com", "fb.me"],
    "has_social_instagram": ["instagram.com"],
    "has_social_x": ["x.com", "twitter.com"],
    "has_social_youtube": ["youtube.com", "youtu.be"],
    "has_social_reddit": ["reddit.com"],
    "has_ikman_lk": ["ikman.lk"],
}

_JOB_BOARD_HOSTS = (
    "jobseeker.lk",
    "jobseekers.lk",
    "topjobs.lk",
    "xjobs.lk",
    "lk.jobsdb.com",
    "jobsdb.com",
    "indeed.com",
    "glassdoor.com",
    "linkedin.com/jobs",
    "ikman.lk",
)

_SOCIAL_HOSTS = (
    "facebook.com",
    "fb.com",
    "fb.me",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
    "tiktok.com",
)

_SCAM_KEYWORDS = [
    "scam",
    "fraud",
    "fake job",
    "fake company",
    "blacklist",
    "never pay",
    "salary not paid",
    "advance fee",
    "pay to apply",
    "registration fee scam",
    "ponzi",
    "pyramid",
]

_POSITIVE_KEYWORDS = [
    "reliable",
    "trusted",
    "trustworthy",
    "legitimate",
    "recommend",
    "great company",
    "good employer",
    "professional",
    "reputable",
    "well known",
    "established",
    "verified",
    "pays on time",
    "good workplace",
    "reputed company",
    "trusted employer",
]

_HTML_LINK_PATTERN = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
_JSONLD_PATTERN = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)


def _empty_result() -> Dict[str, int]:
    return {key: 0 for key in _SOCIAL_AND_REVIEW_KEYS}


def _fetch_page(url: str, timeout: int = 6) -> str:
    response = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    return response.text


def _extract_links(html: str, base_url: str) -> Iterable[str]:
    for match in _HTML_LINK_PATTERN.findall(html or ""):
        if match.startswith("mailto:") or match.startswith("tel:"):
            continue
        yield urljoin(base_url, match)


def _classify_link(url: str) -> Optional[str]:
    normalized = (url or "").lower()
    for key, markers in _PROFILE_MATCHERS.items():
        if any(marker in normalized for marker in markers):
            return key
    return None


def _host_is_social(url: str) -> bool:
    host = (urlparse(url or "").netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return any(host == h or host.endswith("." + h) for h in _SOCIAL_HOSTS)


def is_job_board_url(url: str | None) -> bool:
    if not url:
        return False
    lowered = (url or "").lower()
    host = (urlparse(lowered).netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if any(host == h or host.endswith("." + h) for h in _JOB_BOARD_HOSTS if "/" not in h):
        return True
    return any(marker in lowered for marker in _JOB_BOARD_HOSTS)


def normalize_company_name(company_name: str | None) -> str:
    """Trim and undo accidental duplicated pastes like 'Anthem StudiosAnthem Studios'."""
    name = re.sub(r"\s+", " ", (company_name or "").strip())
    if not name:
        return ""

    # Exact half-duplication without separator: "Foo BarFoo Bar"
    compact = re.sub(r"\s+", "", name.lower())
    if len(compact) >= 6 and len(compact) % 2 == 0:
        half = len(compact) // 2
        if compact[:half] == compact[half:]:
            # Reconstruct from original by taking first half of tokens roughly
            mid = len(name) // 2
            # Prefer splitting on a repeated phrase boundary
            for size in range(len(name) // 2, 2, -1):
                left = name[:size].strip()
                right = name[size:].strip()
                if left.lower() == right.lower() and left:
                    return left

    # Spaced duplication: "Foo Bar Foo Bar"
    tokens = name.split()
    if len(tokens) >= 2 and len(tokens) % 2 == 0:
        half = len(tokens) // 2
        if [t.lower() for t in tokens[:half]] == [t.lower() for t in tokens[half:]]:
            return " ".join(tokens[:half])

    return name


def _company_tokens(company_name: str) -> List[str]:
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", (company_name or "").lower())
    return [t for t in cleaned.split() if len(t) >= 3]


def _hit_mentions_company(text: str, company_name: str) -> bool:
    tokens = _company_tokens(company_name)
    if not tokens:
        return False
    lowered = (text or "").lower()
    hits = sum(1 for t in tokens if t in lowered)
    return hits >= max(1, min(2, len(tokens)))


def _classify_search_hit(href: str, title: str, body: str, company_name: str) -> Optional[str]:
    blob = f"{title} {body} {href}".lower()
    href_l = (href or "").lower()

    # Prefer precise LinkedIn company pages; ignore job ads on LinkedIn
    if "linkedin.com" in href_l or "linkedin.com" in blob:
        if "/jobs/" in href_l:
            return None
        if any(p in href_l for p in ("/company/", "/school/", "/showcase/")):
            return "has_linkedin"
        if "linkedin.com" in href_l and _hit_mentions_company(f"{title} {body}", company_name):
            return "has_linkedin"

    key = _classify_link(href) or _classify_link(blob)
    if key == "has_linkedin" and "/jobs/" in href_l:
        return None
    return key


def _try_json_api(url: str, timeout: int = 5) -> bool:
    try:
        response = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        return True
    except Exception as exc:
        logger.debug("[REV] API request failed for %s: %s", url, str(exc)[:160])
        return False


def _supports_youtube_oembed(url: str) -> bool:
    api_url = f"https://www.youtube.com/oembed?url={quote_plus(url)}&format=json"
    return _try_json_api(api_url)


def _supports_x_oembed(url: str) -> bool:
    api_url = f"https://publish.twitter.com/oembed?url={quote_plus(url)}"
    return _try_json_api(api_url)


def _has_structured_reviews(page_html: str) -> bool:
    if not page_html:
        return False
    lowered = page_html.lower()
    if any(token in lowered for token in ["aggregaterating", "reviewcount", "ratingvalue", "reviews"]):
        return True
    for blob in _JSONLD_PATTERN.findall(page_html):
        if any(token in blob.lower() for token in ["aggregaterating", "reviewcount", "ratingvalue"]):
            return True
    return False


def _merge_flag(result: Dict[str, int], key: str, value: int = 1) -> None:
    if key in result and value:
        result[key] = 1


def _apply_url_as_presence(result: Dict[str, int], url: str) -> bool:
    """If the given URL is itself a social/review profile, mark presence."""
    key = _classify_link(url)
    if not key:
        return False
    _merge_flag(result, key)
    if _host_is_social(url):
        result["social_only_presence"] = 1
    return True


def _signals_from_page_links(result: Dict[str, int], website_url: str) -> None:
    try:
        html = _fetch_page(website_url, timeout=6)
    except Exception as exc:
        logger.debug("[REV] could not fetch website for %s: %s", website_url, str(exc)[:160])
        return

    discovered_links = set(_extract_links(html, website_url))
    for link in discovered_links:
        key = _classify_link(link)
        if not key:
            continue

        if key == "has_social_youtube":
            if _supports_youtube_oembed(link):
                result[key] = 1
            continue
        if key == "has_social_x":
            if _supports_x_oembed(link):
                result[key] = 1
            continue

        result[key] = 1

        if key in {"has_trustpilot", "has_sitejabber"}:
            try:
                profile_html = _fetch_page(link, timeout=6)
                if _has_structured_reviews(profile_html):
                    result["has_website_reviews"] = 1
            except Exception as exc:
                logger.debug("[REV] profile fetch failed for %s: %s", link, str(exc)[:160])

    lowered = html.lower()
    if any(
        term in lowered
        for term in (
            "testimonial",
            "testimonials",
            "what our clients say",
            "client says",
            "aggregaterating",
            "reviewcount",
        )
    ):
        result["has_website_reviews"] = 1


def _search_reviews_by_name(company_name: str) -> Tuple[Dict[str, int], int, int]:
    """
    Lightweight live version of notebooks/review_extractor.py:
    search for reviews / social / job platforms by company name.
    """
    found = _empty_result()
    company_name = normalize_company_name(company_name)
    if not company_name:
        return found, 0, 0

    try:
        from duckduckgo_search import DDGS
    except Exception:
        logger.debug("[REV] duckduckgo_search unavailable")
        return found, 0, 0

    # Dedicated LinkedIn / Facebook queries — generic OR searches often miss company pages
    queries = [
        f'"{company_name}" site:linkedin.com/company',
        f'"{company_name}" site:facebook.com',
        f'"{company_name}" LinkedIn Sri Lanka',
        f'"{company_name}" reviews OR google reviews OR trustpilot',
        f'"{company_name}" glassdoor OR indeed OR topjobs.lk',
        f'"{company_name}" scam OR fraud OR fake job Sri Lanka',
    ]

    snippets: List[str] = []
    try:
        with DDGS() as ddgs:
            for query in queries:
                try:
                    hits = list(ddgs.text(query, max_results=5)) or []
                except Exception as exc:
                    logger.debug("[REV] search failed for %s: %s", query[:60], str(exc)[:120])
                    continue
                for hit in hits:
                    href = str(hit.get("href") or hit.get("link") or "")
                    title = str(hit.get("title") or "")
                    body = str(hit.get("body") or hit.get("snippet") or "")
                    blob = f"{title} {body} {href}".lower()
                    snippets.append(blob)
                    key = _classify_search_hit(href, title, body, company_name)
                    if key:
                        found[key] = 1
                        logger.info("[REV] presence %s via %s", key, href[:120] or title[:80])
    except Exception as exc:
        logger.debug("[REV] DDGS session failed: %s", str(exc)[:160])
        return found, 0, 0

    scam_hits = 0
    positive_hits = 0
    for text in snippets:
        scam_hits += sum(1 for k in _SCAM_KEYWORDS if k in text)
        positive_hits += sum(1 for k in _POSITIVE_KEYWORDS if k in text)

    if positive_hits > 0:
        found["has_positive_reviews"] = 1
    if scam_hits > 0:
        found["has_negative_reviews"] = 1
        # Only escalate to hard scam when negatives clearly dominate
        if scam_hits >= max(2, positive_hits + 1):
            found["has_scam_report"] = 1

    return found, positive_hits, scam_hits


def aggregate_review_signals(company_name: str, website_url: str | None) -> Dict[str, int]:
    """
    Discover review/social presence from:
    1) the provided URL itself (social-only businesses),
    2) outbound links on a traditional website / job post,
    3) company-name web search (same idea as training review_extractor).
    Cached briefly so repeat checks don't flip when search APIs flake.
    """
    company_name = normalize_company_name(company_name)
    cache_key = f"{(company_name or '').strip().lower()}|{(website_url or '').strip().lower()}"
    now = time.time()
    cached = _REP_RESULT_CACHE.get(cache_key)
    if cached is not None:
        ts, payload = cached
        if (now - ts) < _REP_RESULT_CACHE_TTL_SEC:
            logger.info("[REV] cache hit for %r", company_name)
            return deepcopy(payload)

    result = _aggregate_review_signals_uncached(company_name, website_url)
    _REP_RESULT_CACHE[cache_key] = (now, deepcopy(result))
    return result


def _aggregate_review_signals_uncached(company_name: str, website_url: str | None) -> Dict[str, int]:
    result = _empty_result()
    url = (website_url or "").strip() or None

    if url and not re.match(r"^[a-z][a-z0-9+.-]*://", url, re.I):
        url = "https://" + url

    job_board = is_job_board_url(url)

    if url:
        _apply_url_as_presence(result, url)
        # Always scrape outbound links — job ads often include company Facebook/LinkedIn
        if not _host_is_social(url):
            _signals_from_page_links(result, url)
            if job_board and (result.get("has_topjobs_lk") or "topjobs" in (url or "").lower()):
                result["has_topjobs_lk"] = 1
            if job_board and "jobseeker" in (url or "").lower():
                # Treat job-board listing as weak professional presence, not a company website
                pass
        else:
            try:
                html = _fetch_page(url, timeout=6).lower()
                if any(t in html for t in ("review", "rating", "recommend", "follower", "people like this")):
                    result["has_website_reviews"] = 1
            except Exception:
                pass

    name_signals, _pos, _neg = _search_reviews_by_name(company_name or "")
    for key, value in name_signals.items():
        if value:
            result[key] = 1

    # Social-only if we have social presence and no traditional website scraped
    if url and _host_is_social(url):
        result["social_only_presence"] = 1
    elif (not url or job_board) and any(
        result.get(k)
        for k in (
            "has_social_facebook",
            "has_social_instagram",
            "has_social_x",
            "has_social_youtube",
            "has_linkedin",
        )
    ):
        result["social_only_presence"] = 1

    return result
