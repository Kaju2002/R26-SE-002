# Run this in a new cell or script to test WHOIS directly
import whois
from datetime import datetime

test_urls = [
    "https://www.dialog.lk",
    "https://www.keells.com",
    "https://www.sampath.lk",
]

for url in test_urls:
    try:
        domain = url.replace("https://","").replace("http://","").split("/")[0]
        if domain.startswith("www."):
            domain = domain[4:]
        print(f"\nDomain: {domain}")
        w = whois.whois(domain)
        print(f"  Creation date: {w.creation_date}")
        print(f"  Registrar: {w.registrar}")
    except Exception as e:
        print(f"  ERROR: {e}")