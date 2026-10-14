# Assistant API — port 8004 (scam=8000, employer=8001, job-recommendation=8002, fake-job=8003)
Set-Location $PSScriptRoot
$python = if (Test-Path ".venv\Scripts\python.exe") { ".venv\Scripts\python.exe" } else { "py" }
& $python -m uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
