from urllib.parse import urlparse
import whois
from datetime import datetime
import requests
from bs4 import BeautifulSoup

#Email Features
FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]

def is_free_email(email):
    try:
        if pd.isna(email):
            return 1
        domain = email.split("@")[-1]
        return 1 if domain in FREE_EMAIL_DOMAINS else 0
    except:
        return 1
 
 #WHOIS Features   
def get_domain_age(domain):
    try:
        w = whois.whois(domain)
        creation = w.creation_date

        if isinstance(creation, list):
            creation = creation[0]

        if creation is None:
            return 0

        return (datetime.now() - creation).days
    except:
        return 0
    
#Website Scrapping Features
def get_website_text(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, timeout=5, headers=headers)
        soup = BeautifulSoup(r.text, "html.parser")
        return soup.get_text().lower()
    except:
        return ""
