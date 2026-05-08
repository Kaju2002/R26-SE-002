import requests
def search_company_website(company_name: str) -> str:
    """
    Search for company website with Sri Lanka (.lk) preference using duckduckgo_search.
    """
    from duckduckgo_search import DDGS
    import time
    bad_domains = [
        "facebook.com", "linkedin.com", "twitter.com", "wikipedia.org",
        "adaderana.lk", "ft.lk", "dailymirror.lk", "investing.com",
        "glassdoor.com", "indeed.com", "bloomberg.com", "reuters.com",
        "youtube.com", "crunchbase.com", "zoominfo.com"
    ]
    queries = [
        f'"{company_name}" site:.lk',
        f'"{company_name}" official website Sri Lanka',
        f'"{company_name}" Sri Lanka',
        f'"{company_name}" official website',
    ]
    for query in queries:
        try:
            with DDGS() as ddgs:
                results = ddgs.text(query, max_results=7)
                # Prefer .lk domains
                for r in results:
                    url = r.get("href", "")
                    if any(bd in url for bd in bad_domains):
                        continue
                    if ".lk" in url:
                        return url
                # Fallback: return first clean result
                for r in results:
                    url = r.get("href", "")
                    if not any(bd in url for bd in bad_domains):
                        return url
            time.sleep(1)
        except Exception:
            continue
    return None
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

import joblib
import pandas as pd
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.employer_verification_model.feature_engine import get_website_text, check_page_exists
from urllib.parse import urlparse
import re
import numpy as np

# Load model and features
MODEL_PATH = os.path.join(os.path.dirname(__file__), '../models/final_realistic_model.pkl')
model_bundle = joblib.load(MODEL_PATH)
model = model_bundle['model']
feature_cols = model_bundle['features']

app = FastAPI(title="Employer Verification API")

class CompanyInput(BaseModel):
    company_name: Optional[str] = None
    email: Optional[str] = None
    website_url: Optional[str] = None

FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]
SUSPICIOUS_TLDS = [".xyz", ".club", ".biz", ".online", ".site", ".info", ".io"]

def extract_features_from_input(input: CompanyInput):
    features = {col: 0 for col in feature_cols}
    info_available = []
    # Website features
    url = input.website_url
    auto_searched = False
    # If no website provided, try to search using company name
    if not url and input.company_name:
        url = search_company_website(input.company_name)
        if url:
            auto_searched = True
    if url:
        info_available.append('website')
        features['auto_searched_website'] = auto_searched
        features['has_https'] = int(str(url).startswith('https://'))
        features['subdomain_count'] = str(urlparse(url).netloc).count('.')
        features['domain_length'] = len(urlparse(url).netloc)
        web_text = ""
        try:
            features['has_about'] = check_page_exists(url, "about")
        except Exception:
            features['has_about'] = -1
        try:
            features['has_contact'] = check_page_exists(url, "contact")
        except Exception:
            features['has_contact'] = -1
        try:
            web_text = get_website_text(url)
        except Exception:
            web_text = ""
        features['content_length'] = len(web_text)
        scrape_failed = len(web_text) < 100
        features['scrape_failed'] = int(scrape_failed)
        if scrape_failed:
            # Use -1 for unknown content-based features
            features['has_about'] = -1
            features['has_contact'] = -1
            features['scam_score'] = -1
            features['has_privacy_policy'] = -1
            features['has_terms'] = -1
            features['has_payment_risk'] = 0
            features['has_urgency_language'] = 0
        else:
            features['scam_score'] = sum(1 for word in [
                "urgent", "apply now", "limited time", "registration fee", "payment required",
                "bitcoin", "crypto", "wire transfer", "guaranteed job", "no experience needed",
                "earn money fast", "work from home easily"
            ] if word in web_text)
            features['has_privacy_policy'] = int("privacy policy" in web_text)
            features['has_terms'] = int(any(t in web_text for t in ["terms and conditions", "terms of service", "terms of use"]))
            features['has_payment_risk'] = int(any(k in web_text for k in [
                "cryptocurrency", "bitcoin", "btc", "usdt", "wire transfer",
                "western union", "moneygram", "cash app", "send money first",
                "pay to apply", "payoneer advance"]))
            features['has_urgency_language'] = int(any(k in web_text for k in [
                "act now", "limited time", "urgent", "hurry", "expires soon",
                "don't miss", "apply immediately", "today only", "last chance",
                "seats are limited", "only a few spots"]))
        features['is_registered'] = 1  # Assume registered if URL is provided
        features['has_suspicious_tld'] = int(any(t in str(url).lower() for t in SUSPICIOUS_TLDS))
        features['is_http_only'] = int(not features['has_https'])
    # Email features
    if input.email:
        info_available.append('email')
        email = input.email
        domain = email.split("@")[-1]
        features['email_type_encoded'] = 0 if domain in FREE_EMAIL_DOMAINS else 2
    else:
        features['email_type_encoded'] = 1  # unknown
    # Derived features
    features['trust_score'] = sum(features.get(c, 0) for c in [
        "has_https", "has_about", "has_contact", "has_privacy_policy", "has_terms", "is_registered",
        "website_alive", "has_glassdoor", "has_indeed", "has_trustpilot", "has_topjobs_lk", "has_ikman_lk",
        "has_ft_lk", "has_cse_boi_mention", "has_positive_reviews"] if c in features)
    features['suspicion_score'] = sum(features.get(c, 0) for c in [
        "has_payment_risk", "has_urgency_language", "has_suspicious_tld", "is_http_only", "has_negative_reviews"] if c in features)
    # Fill missing with 0
    for col in feature_cols:
        if features.get(col) is None:
            features[col] = 0
    return features, info_available

@app.post("/predict")
def predict_company(input: CompanyInput):
    features, info_available = extract_features_from_input(input)
    # Debug printout of features
    print("\n[DEBUG] Features sent to model:")
    for k, v in features.items():
        print(f"  {k}: {v}")
    X = pd.DataFrame([[features.get(col, 0) for col in feature_cols]], columns=feature_cols)
    pred = model.predict(X)[0]
    proba = model.predict_proba(X)[0][int(pred)]

    # Confidence logic
    content_signals = [
        features.get("content_length", 0) < 100,
        features.get("has_about", 0) in [0, -1],
        features.get("has_contact", 0) in [0, -1],
        features.get("scam_score", 0) in [0, -1],
        features.get("has_privacy_policy", 0) in [0, -1],
        features.get("has_terms", 0) in [0, -1],
    ]
    scrape_failed = features.get("scrape_failed", 0) == 1
    missing_signals = sum(content_signals)
    low_confidence = scrape_failed or missing_signals >= 4

    # Confidence warning if minimal info
    if not info_available:
        return {
            "prediction": "Unknown",
            "probability": 0.0,
            "confidence": "low",
            "warning": "Not enough information provided. Please provide at least a website or email for a meaningful prediction.",
            "features_used": features
        }
    elif len(info_available) == 1 or low_confidence:
        capped_proba = min(float(proba), 0.65)
        resp = {
            "prediction": "Legit" if pred == 1 else "Fake",
            "probability": capped_proba,
            "confidence": "low",
            "warning": "Low confidence — website could not be fully scanned or too little information. More information (website and email) will improve accuracy.",
            "features_used": features
        }
        if features.get('auto_searched_website'):
            resp["auto_searched_website"] = True
        return resp
    else:
        return {
            "prediction": "Legit" if pred == 1 else "Fake",
            "probability": float(proba),
            "confidence": "high",
            "features_used": features
        }

@app.get("/")
def root():
    return {"message": "Employer Verification API is running."}
