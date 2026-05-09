import requests

url = "https://pickme.lk/"
headers = {"User-Agent": "Mozilla/5.0"}

print("Fetching PickMe site...")
try:
    r = requests.get(url, headers=headers, timeout=6)
    r.raise_for_status()
    text_lower = r.text.lower()
    print(f"✓ Fetched {len(r.text)} bytes\n")
    
    # Check for keywords
    keywords = {
        "DRC": ["registrar of companies", "registration no", "company registration", "reg no", "registered in sri lanka"],
        "CSE": ["colombo stock exchange", "cse", "stock exchange"],
        "BOI": ["board of investment", "boi", "board of investment of sri lanka"],
        "CBSL": ["central bank", "cbsl", "central bank of sri lanka"]
    }
    
    for category, kws in keywords.items():
        found = [kw for kw in kws if kw in text_lower]
        if found:
            print(f"✓ {category}: Found {found}")
        else:
            print(f"✗ {category}: No matches")
    
    # Check page structure
    print("\nChecking DDGS searchability...")
    from duckduckgo_search import DDGS
    
    try:
        with DDGS() as ddgs:
            r = ddgs.text('"PickMe" site:cse.lk', max_results=2)
            if r:
                print(f"✓ CSE DDGS search found {len(r)} results")
            else:
                print("✗ CSE DDGS search returned empty")
    except Exception as e:
        print(f"✗ DDGS error: {e}")
        
except Exception as e:
    print(f"✗ Error: {e}")
