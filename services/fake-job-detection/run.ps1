# Fake job detection API — port 8003 (8000 scam, 8001 employer, 8002 job-recommendation)
Set-Location $PSScriptRoot
python -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload
