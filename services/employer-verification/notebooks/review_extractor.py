"""
review_extractor.py
Searches for company reviews across multiple platforms using DuckDuckGo,
with special focus on Sri Lankan platforms and local signals.

Platforms checked:
  Global:
    - Glassdoor, Indeed, Trustpilot, Google Reviews

  Sri Lanka specific:
    - TopJobs.lk          (main LK job board)
    - Xjobs.lk            (Sri Lankan jobs)
    - JobsDB Sri Lanka
    - ikman.lk            (LK classifieds — job complaints common here)
    - Ada Derana Biz       (LK business news)
    - Daily FT            (Financial Times LK)
    - LankaBIZ / Sri Lanka Business
    - Facebook groups     (scam reports common here)
    - Reddit r/srilanka   (expat/local scam warnings)
    - CSE / BOI mentions  (registration signals)
    - Google Maps reviews (physical address + rating)

Score output:
  1.0  = clearly legitimate / trusted
  0.5  = neutral / not enough data
  0.0  = scam signals detected
"""

import time
from duckduckgo_search import DDGS


# ── Scam / negative keywords ───────────────────────────────────────────────

SCAM_KEYWORDS = [
    # Universal
    "scam", "fraud", "fake", "cheat", "cheated", "blacklist",
    "avoid", "warning", "beware", "never pay", "they stole",
    "did not pay", "no salary", "salary not paid", "run away",
    "ponzi", "pyramid", "mlm scam", "fake job", "ghost job",
    "never received", "money lost", "trap", "con", "swindled",
    "advance fee", "pay to apply", "pay before joining",
    "send money first", "registration fee scam",

    # Sri Lanka specific English
    "topjobs scam", "ikman scam", "fake employer sri lanka",
    "job scam colombo", "employment scam sri lanka",
    "work from home scam sri lanka", "online job scam lanka",
    "complaint sri lanka", "reported fraud lanka",
    "cse delisted", "suspended licence", "cbsl action",

    # Sinhala romanized (common in FB comments / forums)
    "kawadawath epa",        # never go
    "money gatta",           # took money
"scam ekak",             # it's a scam
    "fake ekak",             # it's fake
    "wadak na",              # no work given
    "salary denna ne",       # won't give salary
    "gevenna behe",          # can't pay
]

# ── Positive / trust keywords ──────────────────────────────────────────────

POSITIVE_KEYWORDS = [
    # Universal
    "reliable", "trusted", "trustworthy", "legitimate", "legit",
    "excellent", "recommend", "great company", "good employer",
    "professional", "reputable", "well known", "established",
    "verified", "good salary", "pays on time", "good workplace",
    "best company", "top employer", "certified", "award winning",

    # Sri Lanka specific
    "cse listed", "boi registered", "cbsl licensed",
    "registered company sri lanka", "sec registered",
    "licensed by", "central bank approved",
    "topjobs verified", "established company lanka",
    "well known in sri lanka", "leading company sri lanka",
    "reputed company colombo", "trusted employer lanka",
    "good company sri lanka", "best employer sri lanka",
    "pays well sri lanka", "good work environment lanka",
]

# ── Platform sources ───────────────────────────────────────────────────────

# Global platforms
GLOBAL_PLATFORMS = {
    "glassdoor" : "glassdoor.com",
    "indeed"    : "indeed.com",
    "trustpilot": "trustpilot.com",
}

# Sri Lanka specific platforms
LK_PLATFORMS = {
    "topjobs"      : "topjobs.lk",
    "xjobs"        : "xjobs.lk",
    "jobsdb_lk"    : "lk.jobsdb.com",
    "ikman"        : "ikman.lk",
    "adaderana_biz": "bizenglish.adaderana.lk",
    "daily_ft"     : "ft.lk",
    "lankabiz"     : "srilankabusiness.com",
    "cse"          : "cse.lk",
    "boi"          : "boi.lk",
    "cbsl"         : "cbsl.gov.lk",
}

# Social / community platforms (scam reports common here)
COMMUNITY_PLATFORMS = {
    "facebook"  : "facebook.com",
    "reddit"    : "reddit.com/r/srilanka",
    "youtube"   : "youtube.com",
}

ALL_PLATFORMS = {**GLOBAL_PLATFORMS, **LK_PLATFORMS, **COMMUNITY_PLATFORMS}


# ── Search queries ─────────────────────────────────────────────────────────

def build_queries(company_name: str) -> list:
    """Build targeted search queries for a company."""
    return [
        # General reviews
        f'"{company_name}" reviews',

        # Global job platforms
        f'"{company_name}" glassdoor OR indeed OR trustpilot',

        # Sri Lanka job platforms
        f'"{company_name}" topjobs.lk OR xjobs.lk OR ikman.lk',

        # Sri Lanka business/news
        f'"{company_name}" site:ft.lk OR site:bizenglish.adaderana.lk',

        # Scam detection — Sri Lanka context
        f'"{company_name}" scam OR fraud OR fake job Sri Lanka',

        # Registration / legitimacy signals
        f'"{company_name}" CSE listed OR BOI registered OR CBSL licensed',

        # Community / social reports
        f'"{company_name}" reddit OR facebook complaint Sri Lanka',
    ]


# ── Search ─────────────────────────────────────────────────────────────────

def search_reviews(company_name: str, max_results: int = 5) -> list:
    """Search DuckDuckGo with multiple queries and return all results."""
    all_results = []
    queries = build_queries(company_name)

    for query in queries:
        try:
            with DDGS() as ddgs:
                hits = ddgs.text(query, max_results=max_results)
                if hits:
                    all_results.extend(hits)
            time.sleep(1.0)
        except Exception:
            time.sleep(2.0)   # back off on error
            continue

    return all_results


# ── Analysis ───────────────────────────────────────────────────────────────

def analyze_reviews(results: list, company_name: str) -> dict:
    """Analyze search snippets for sentiment and platform signals."""

    scam_hits     = 0
    positive_hits = 0
    platforms_found = {k: 0 for k in ALL_PLATFORMS}
    lk_platform_hits = 0
    global_platform_hits = 0
    registration_signals = 0

    registration_keywords = [
        "cse listed", "boi registered", "cbsl licensed",
        "sec registered", "licensed", "central bank",
        "colombo stock exchange", "board of investment",
    ]

    for r in results:
        text = (
            str(r.get("title", "")) + " " +
            str(r.get("body",  "")) + " " +
            str(r.get("href",  ""))
        ).lower()

        # Platform detection
        for platform_key, domain in ALL_PLATFORMS.items():
            if domain in text:
                platforms_found[platform_key] += 1
                if platform_key in LK_PLATFORMS:
                    lk_platform_hits += 1
                if platform_key in GLOBAL_PLATFORMS:
                    global_platform_hits += 1

        # Sentiment
        scam_hits     += sum(1 for k in SCAM_KEYWORDS     if k in text)
        positive_hits += sum(1 for k in POSITIVE_KEYWORDS if k in text)

        # Registration signals
        registration_signals += sum(
            1 for k in registration_keywords if k in text
        )

    active_platforms = [k for k, v in platforms_found.items() if v > 0]

    return {
        "scam_hits"           : scam_hits,
        "positive_hits"       : positive_hits,
        "platforms_found"     : active_platforms,
        "lk_platform_hits"    : lk_platform_hits,
        "global_platform_hits": global_platform_hits,
        "registration_signals": registration_signals,
        "result_count"        : len(results),
    }


# ── Scoring ────────────────────────────────────────────────────────────────

def calculate_review_score(analysis: dict) -> float:
    """
    Score logic:
      - No results                          → 0.5 (neutral)
      - Has registration signals (CSE/BOI)  → boost toward 1.0
      - Scam keywords dominate              → push toward 0.0
      - Positive keywords dominate          → push toward 1.0
      - Found on LK platforms               → small positive boost
    """
    if analysis["result_count"] == 0:
        return 0.5

    scam     = analysis["scam_hits"]
    positive = analysis["positive_hits"]
    reg      = analysis["registration_signals"]
    lk_hits  = analysis["lk_platform_hits"]
    total    = scam + positive

    # Base score
    if total == 0:
        score = 0.5
    elif scam > positive * 2:
        score = max(0.0, 0.25 - (scam * 0.02))
    elif positive > scam * 2:
        score = min(0.95, 0.65 + (positive * 0.03))
    else:
        ratio = positive / total
        score = 0.35 + (ratio * 0.3)

    # Boost for CSE/BOI/CBSL registration signals
    if reg > 0:
        score = min(1.0, score + (reg * 0.05))

    # Small boost for appearing on LK platforms (topjobs, ft.lk etc.)
    if lk_hits > 0:
        score = min(1.0, score + 0.05)

    return round(max(0.0, min(1.0, score)), 2)


# ── Main function (called from extract_features.py) ───────────────────────

def get_review_features(company_name: str) -> dict:
    """
    Returns a dict of review-based features for a company.

    Features:
        review_score          float  0.0–1.0
        review_count          int    search results found
        has_glassdoor         int    1/0
        has_indeed            int    1/0
        has_trustpilot        int    1/0
        has_topjobs_lk        int    1/0  ← Sri Lanka specific
        has_ikman_lk          int    1/0  ← Sri Lanka specific
        has_ft_lk             int    1/0  ← Financial Times LK
        has_cse_boi_mention   int    1/0  ← registration signal
        has_negative_reviews  int    1/0
        has_positive_reviews  int    1/0
        lk_platform_presence  int    count of LK platforms found
    """
    default = {
        "review_score"        : 0.5,
        "review_count"        : 0,
        "has_glassdoor"       : 0,
        "has_indeed"          : 0,
        "has_trustpilot"      : 0,
        "has_topjobs_lk"      : 0,
        "has_ikman_lk"        : 0,
        "has_ft_lk"           : 0,
        "has_cse_boi_mention" : 0,
        "has_negative_reviews": 0,
        "has_positive_reviews": 0,
        "lk_platform_presence": 0,
    }

    if not company_name or str(company_name) == "nan":
        return default

    try:
        results  = search_reviews(str(company_name))
        analysis = analyze_reviews(results, str(company_name))
        score    = calculate_review_score(analysis)
        platforms = analysis["platforms_found"]

        return {
            "review_score"        : score,
            "review_count"        : analysis["result_count"],
            "has_glassdoor"       : 1 if "glassdoor"  in platforms else 0,
            "has_indeed"          : 1 if "indeed"      in platforms else 0,
            "has_trustpilot"      : 1 if "trustpilot"  in platforms else 0,
            "has_topjobs_lk"      : 1 if "topjobs"     in platforms else 0,
            "has_ikman_lk"        : 1 if "ikman"       in platforms else 0,
            "has_ft_lk"           : 1 if "daily_ft"    in platforms else 0,
            "has_cse_boi_mention" : 1 if analysis["registration_signals"] > 0 else 0,
            "has_negative_reviews": 1 if analysis["scam_hits"] > 0 else 0,
            "has_positive_reviews": 1 if analysis["positive_hits"] > 0 else 0,
            "lk_platform_presence": analysis["lk_platform_hits"],
        }

    except Exception as e:
        print(f"    [review] Error for '{company_name}': {e}")
        return default


# ── Quick test ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    test_companies = [
        "John Keells Holdings PLC",       # well-known CSE listed
        "Dialog Axiata PLC",              # well-known CSE listed
        "Hatton National Bank PLC",       # CSE listed bank
        "Easy Marketing Work From Home",  # obvious scam pattern
    ]

    for company in test_companies:
        print(f"\n{'='*55}")
        print(f"Company : {company}")
        result = get_review_features(company)
        for k, v in result.items():
            print(f"  {k:<25}: {v}")
        time.sleep(3)