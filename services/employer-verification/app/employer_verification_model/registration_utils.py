from duckduckgo_search import DDGS

def check_registration_status(company_name: str) -> dict:
    """
    Check if company is officially registered in Sri Lanka (CSE, BOI, CBSL).
    """
    results = {
        "is_cse_listed": 0,
        "is_boi_registered": 0,
        "is_cbsl_licensed": 0,
    }
    try:
        # Search CSE company list
        with DDGS() as ddgs:
            cse = ddgs.text(f'"{company_name}" site:cse.lk', max_results=3)
            if cse:
                results["is_cse_listed"] = 1
        # Search BOI registry
        with DDGS() as ddgs:
            boi = ddgs.text(f'"{company_name}" site:boi.lk', max_results=3)
            if boi:
                results["is_boi_registered"] = 1
        # Search CBSL licensed institutions
        with DDGS() as ddgs:
            cbsl = ddgs.text(f'"{company_name}" site:cbsl.gov.lk', max_results=3)
            if cbsl:
                results["is_cbsl_licensed"] = 1
    except Exception:
        pass
    return results

def check_professional_presence(company_name: str) -> dict:
    """
    Check for company presence on LinkedIn, topjobs.lk, glassdoor, indeed, ft.lk, adaderana, ikman, reddit, facebook.
    """
    signals = {
        "has_linkedin": 0,
        "has_topjobs": 0,
        "has_glassdoor": 0,
        "has_indeed": 0,
        "has_ftlk": 0,
        "has_adaderana": 0,
        "has_scam_report": 0,
    }
    try:
        with DDGS() as ddgs:
            # Professional platforms
            if ddgs.text(f'"{company_name}" site:linkedin.com/company', max_results=2):
                signals["has_linkedin"] = 1
            if ddgs.text(f'"{company_name}" site:topjobs.lk', max_results=2):
                signals["has_topjobs"] = 1
            if ddgs.text(f'"{company_name}" site:glassdoor.com', max_results=2):
                signals["has_glassdoor"] = 1
            if ddgs.text(f'"{company_name}" site:indeed.com', max_results=2):
                signals["has_indeed"] = 1
            # News/business
            if ddgs.text(f'"{company_name}" site:ft.lk', max_results=2):
                signals["has_ftlk"] = 1
            if ddgs.text(f'"{company_name}" site:adaderana.lk', max_results=2):
                signals["has_adaderana"] = 1
            # Scam reports
            scam_sites = ["ikman.lk", "reddit.com", "facebook.com", "scamadviser.com"]
            for site in scam_sites:
                if ddgs.text(f'"{company_name}" scam site:{site}', max_results=2):
                    signals["has_scam_report"] = 1
    except Exception:
        pass
    return signals
