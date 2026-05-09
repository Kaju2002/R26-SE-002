import requests

search_url = "https://eroc.drc.gov.lk/home/search"
headers = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded"}
payload = {"search": "PickMe"}

print("Fetching eROC search page...")
resp = requests.post(search_url, data=payload, headers=headers, timeout=10)
print(f"Status code: {resp.status_code}")
print(f"URL: {resp.url}")
print("\nResponse HTML (first 2000 chars):")
print(resp.text[:2000])
