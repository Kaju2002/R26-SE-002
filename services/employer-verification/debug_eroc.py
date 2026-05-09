import requests
from bs4 import BeautifulSoup

search_url = "https://eroc.drc.gov.lk/home/search"
headers = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded"}
payload = {"search": "PickMe"}

print("Fetching eROC search page...")
try:
    resp = requests.post(search_url, data=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    print(f"Status code: {resp.status_code}")
    print(f"Response length: {len(resp.text)} chars\n")
    
    # Try to parse as HTML
    soup = BeautifulSoup(resp.text, "html.parser")
    
    # Look for all tables
    tables = soup.find_all("table")
    print(f"Found {len(tables)} tables\n")
    
    # Look for all rows
    rows = soup.find_all("tr")
    print(f"Found {len(rows)} rows total\n")
    
    # Print first 10 rows with content
    for i, row in enumerate(rows[:15]):
        cells = row.find_all("td")
        if cells:
            print(f"Row {i}: {len(cells)} cells")
            for j, cell in enumerate(cells[:3]):
                text = cell.get_text(strip=True)[:100]
                print(f"  Cell {j}: {text}")
            print()
    
    # Look for any text containing "PickMe"
    page_text = soup.get_text().lower()
    if "pickme" in page_text:
        print("✓ 'pickme' found in page text")
    else:
        print("✗ 'pickme' NOT found in page text")
        
except Exception as e:
    print(f"Error: {e}")
