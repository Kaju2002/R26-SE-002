import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import pandas as pd

SCAM_KEYWORDS = [
    "urgent", "apply now", "limited time",
    "registration fee", "payment required",
    "bitcoin", "crypto", "wire transfer",
    "guaranteed job", "no experience needed",
    "earn money fast", "work from home easily"
]

def get_website_text(url):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    def extract_text_from_html(html):
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True).lower()

    # Strategy 1: Direct request
    try:
        print(f"[DEBUG] Fetching website: {url}")
        r = requests.get(url, timeout=10, headers=headers)
        print(f"[DEBUG] HTTP status: {r.status_code}, Content-Type: {r.headers.get('content-type')}")
        text = extract_text_from_html(r.text)
        print(f"[DEBUG] Extracted text length: {len(text)}")
        if len(text) > 100:
            return text
    except Exception as e:
        print(f"[ERROR] Direct fetch failed: {e}")

    # Strategy 2: Try www. prefix if missing
    try:
        if not url.startswith("https://www."):
            domain = url.replace("https://","").replace("http://","")
            url_www = f"https://www.{domain}"
            print(f"[DEBUG] Trying www. prefix: {url_www}")
            r = requests.get(url_www, timeout=10, headers=headers)
            text = extract_text_from_html(r.text)
            print(f"[DEBUG] [www] Extracted text length: {len(text)}")
            if len(text) > 100:
                return text
    except Exception as e:
        print(f"[ERROR] www. fetch failed: {e}")

    # Strategy 3: Try HTTP instead of HTTPS
    try:
        url_http = url.replace("https://", "http://")
        print(f"[DEBUG] Trying HTTP: {url_http}")
        r = requests.get(url_http, timeout=10, headers=headers)
        text = extract_text_from_html(r.text)
        print(f"[DEBUG] [http] Extracted text length: {len(text)}")
        if len(text) > 100:
            return text
    except Exception as e:
        print(f"[ERROR] HTTP fetch failed: {e}")

    print(f"[ERROR] All scraping strategies failed or content too short for {url}")
    return ""
    
def check_page_exists(url, keyword):
    try:
        print(f"[DEBUG] Checking for page '{keyword}' in {url}")
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, timeout=6, headers=headers)
        print(f"[DEBUG] HTTP status: {r.status_code}, Content-Type: {r.headers.get('content-type')}")
        soup = BeautifulSoup(r.text, "html.parser")

        links = soup.find_all("a")

        for link in links:
            href = link.get("href", "")
            if keyword in href.lower():
                print(f"[DEBUG] Found '{keyword}' in link: {href}")
                return 1

        print(f"[DEBUG] '{keyword}' not found in any link.")
        return 0
    except Exception as e:
        print(f"[ERROR] Failed to check page '{keyword}' in {url}: {e}")
        return 0
    
def extract_features(df):

    df["domain"] = df["website_url"].apply(lambda x: urlparse(x).netloc)

    df["domain_length"] = df["domain"].apply(len)
    df["subdomain_count"] = df["domain"].str.count(r"\.")

    # REAL scraping signals
    df["has_about"] = df["website_url"].apply(lambda x: check_page_exists(x, "about"))
    df["has_contact"] = df["website_url"].apply(lambda x: check_page_exists(x, "contact"))

    # REAL content extraction
    df["content_length"] = df["website_url"].apply(
        lambda x: len(get_website_text(x))
    )
    
    df["scam_score"] = df["website_url"].apply(
    lambda x: scam_keyword_score(get_website_text(x))
    )

    return df

def scam_keyword_score(text):
    try:
        text = text.lower()
        return sum(1 for word in SCAM_KEYWORDS if word in text)
    except:
        return 0

if __name__ == "__main__":
    df = pd.read_csv("data/final_merged_company_dataset.csv")

    df = extract_features(df)

    df.to_csv("data/feature_dataset.csv", index=False)

    print("Feature engineering completed!")
    
