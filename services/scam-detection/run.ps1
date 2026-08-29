# Scam detection API — port 8000 (employer=8001, job-recommendation=8002, fake-job=8003)
Set-Location $PSScriptRoot
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
