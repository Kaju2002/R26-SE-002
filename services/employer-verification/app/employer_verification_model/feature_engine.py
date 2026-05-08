import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import pandas as pd

SCAM_KEYWORDS = [
    SCAM_KEYWORDS = [
    "urgent", "apply now", "limited time",
    "registration fee", "payment required",
    "bitcoin", "crypto", "wire transfer",
    "guaranteed job", "no experience needed",
    "earn money fast", "work from home easily"
]
]

def get_website_text(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, timeout=8, headers=headers)
        soup = BeautifulSoup(r.text, "html.parser")

        # remove scripts + styles (IMPORTANT)
        for script in soup(["script", "style"]):
            script.extract()

        text = soup.get_text(separator=" ").lower()
        return text
    except:
        return ""
    
def check_page_exists(url, keyword):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, timeout=6, headers=headers)
        soup = BeautifulSoup(r.text, "html.parser")

        links = soup.find_all("a")

        for link in links:
            href = link.get("href", "")
            if keyword in href.lower():
                return 1

        return 0
    except:
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
    
