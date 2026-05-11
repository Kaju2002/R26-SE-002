# Job recommendation API — port 8002 (8000 scam-detection, 8001 employer-verification)
Set-Location $PSScriptRoot
python -m uvicorn app:app --host 0.0.0.0 --port 8002 --reload
