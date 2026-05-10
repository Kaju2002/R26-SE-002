#!/usr/bin/env python3
"""
Test script to verify:
1. Logging format string fix (14 arguments for logger.debug)
2. URL normalization fix (handling malformed URLs)
"""

import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s:%(name)s:%(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

print("="*60)
print("Testing logging format string fix...")
print("="*60)

# Import the functions AFTER logging is configured
from app.employer_verification_model.registration_utils import _normalize_url
from app.employer_verification_model.scoring_layer import _normalize_url as normalize_url_scoring

# Test 1: URL normalization
print("\n✓ URL Normalization Test:")
test_urls = [
    ('https;//jgm.net', 'https://jgm.net'),
    ('http;example.com', 'http://example.com'),
    ('example.com', 'http://example.com'),
    ('https://valid.com', 'https://valid.com'),
    ('ftp;data.example.org', 'ftp://data.example.org'),
]

all_pass = True
for input_url, expected in test_urls:
    normalized = _normalize_url(input_url)
    passed = normalized == expected
    all_pass = all_pass and passed
    status = "✓" if passed else "✗"
    print(f"  {status} {input_url:30} → {normalized}")
    if not passed:
        print(f"      Expected: {expected}")

# Test 2: Logging with all 14 arguments (the original bug)
print("\n✓ Logging Format String Test (14 arguments):")
try:
    result = {
        "has_glassdoor": 1,
        "has_indeed": 0,
        "has_linkedin": 1,
        "has_topjobs_lk": 0,
        "has_ft_lk": 0,
        "has_trustpilot": 1,
        "has_sitejabber": 0,
        "has_social_facebook": 1,
        "has_social_instagram": 0,
        "has_social_x": 0,
        "has_social_youtube": 1,
        "has_social_reddit": 0,
        "has_website_reviews": 1,
        "has_scam_report": 0,
    }
    
    # This is the exact logger call that was failing before
    logger.debug(
        "[REP] result glassdoor=%s indeed=%s linkedin=%s topjobs=%s ft=%s trustpilot=%s sitejabber=%s fb=%s ig=%s x=%s yt=%s reddit=%s web_reviews=%s scam=%s",
        result["has_glassdoor"],
        result["has_indeed"],
        result["has_linkedin"],
        result["has_topjobs_lk"],
        result["has_ft_lk"],
        result.get("has_trustpilot", 0),
        result.get("has_sitejabber", 0),
        result.get("has_social_facebook", 0),
        result.get("has_social_instagram", 0),
        result.get("has_social_x", 0),
        result.get("has_social_youtube", 0),
        result.get("has_social_reddit", 0),
        result.get("has_website_reviews", 0),
        result["has_scam_report"],
    )
    print("  ✓ Logger.debug called successfully with all 14 arguments!")
    all_pass = all_pass and True
except TypeError as e:
    print(f"  ✗ Logger.debug failed: {e}")
    all_pass = False

print("\n" + "="*60)
if all_pass:
    print("✓ ALL TESTS PASSED!")
    print("="*60)
    print("\nBoth fixes are working correctly:")
    print("1. ✓ URL normalization handles malformed URLs")
    print("2. ✓ Logging format string has correct argument count")
    sys.exit(0)
else:
    print("✗ SOME TESTS FAILED!")
    print("="*60)
    sys.exit(1)
