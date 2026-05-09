import requests, json

ports = [8001, 8000, 8002]
body = {"company_name": "PickMe", "email": "careers@pickme.lk", "website_url": "https://pickme.lk/"}

for p in ports:
    url = f"http://127.0.0.1:{p}/predict"
    print("Trying", url)
    try:
        r = requests.post(url, json=body, timeout=20)
        print("---SUCCESS---")
        try:
            print(json.dumps(r.json(), indent=2))
        except Exception:
            print(r.text)
        break
    except Exception as e:
        print("Port", p, "failed:", e)
