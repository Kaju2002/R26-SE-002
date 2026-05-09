from __future__ import annotations

import json
import logging
import re
from typing import Dict, Iterable
from urllib.parse import quote_plus, urljoin, urlparse

import requests

logger = logging.getLogger(__name__)

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
]

_PROFILE_MATCHERS = {
    "has_glassdoor": ["glassdoor.com"],
    "has_indeed": ["indeed.com"],
    "has_linkedin": ["linkedin.com/company", "linkedin.com/in/"],
    "has_topjobs_lk": ["topjobs.lk"],
    "has_ft_lk": ["ft.lk"],
    "has_trustpilot": ["trustpilot.com"],
    "has_sitejabber": ["sitejabber.com"],
    "has_social_facebook": ["facebook.com"],
    "has_social_instagram": ["instagram.com"],
    "has_social_x": ["x.com", "twitter.com"],
    "has_social_youtube": ["youtube.com", "youtu.be"],
    "has_social_reddit": ["reddit.com"],
}

_HTML_LINK_PATTERN = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
_JSONLD_PATTERN = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.IGNORECASE | re.DOTALL)


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


def _classify_link(url: str) -> str | None:
    normalized = (url or "").lower()
    for key, markers in _PROFILE_MATCHERS.items():
        if any(marker in normalized for marker in markers):
            return key
    return None


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


def aggregate_review_signals(company_name: str, website_url: str | None) -> Dict[str, int]:
    """Discover and verify review/social presence using external URLs and API-backed checks."""
    result = _empty_result()
    if not website_url:
        return result

    try:
        html = _fetch_page(website_url, timeout=6)
    except Exception as exc:
        logger.debug("[REV] could not fetch website for %s: %s", company_name, str(exc)[:160])
        return result

    discovered_links = set(_extract_links(html, website_url))
    for link in discovered_links:
        key = _classify_link(link)
        if not key:
            continue

        # Public API-backed verification where available.
        if key == "has_social_youtube":
            if _supports_youtube_oembed(link):
                result[key] = 1
            continue
        if key == "has_social_x":
            if _supports_x_oembed(link):
                result[key] = 1
            continue

        # For other platforms, the site must at least point to an official profile.
        result[key] = 1

        # If the profile page exposes structured review metadata, capture that too.
        if key in {"has_trustpilot", "has_sitejabber"}:
            try:
                profile_html = _fetch_page(link, timeout=6)
                if _has_structured_reviews(profile_html):
                    result["has_website_reviews"] = 1
            except Exception as exc:
                logger.debug("[REV] profile fetch failed for %s: %s", link, str(exc)[:160])

    return result
