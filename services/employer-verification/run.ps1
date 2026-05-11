# Employer verification API — port 8001 (scam-detection typically uses 8000)
Set-Location $PSScriptRoot
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
