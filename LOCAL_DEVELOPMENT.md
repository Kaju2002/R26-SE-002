# CareerNet / FraudAware — Run & Test Commands

## Docker (RabbitMQ)

```powershell
docker compose up -d
```

RabbitMQ UI: http://localhost:15672 — user `fraudaware` / pass `fraudaware`

---

## Node services

```powershell
# Terminal 1 — user-management (5000)
cd services\user-management
npm run dev

# Terminal 2 — job-management (5001)
cd services\job-management
npm run dev

# Terminal 3 — chat-management (5003)
cd services\chat-management
npm run dev

# Terminal 4 — notification-management (5002)
cd services\notification-management
npm run dev

# Terminal 5 — email-management (5004) — optional
cd services\email-management
npm run dev
```

---

## Python ML services

```powershell
# Terminal 6 — scam-detection (8000) — required for InChat scam scan
cd services\scam-detection
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 7 — employer-verification (8001) — company verify
cd services\employer-verification
py -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 8 — job-recommendation (8002) — For You jobs
cd services\job-recommendation
py -m uvicorn app:app --host 0.0.0.0 --port 8002 --reload

# Terminal 9 — fake-job-detection (8003) — Job Post Scanner
cd services\fake-job-detection
$env:ANTHROPIC_API_KEY = "your_key"
py -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload

# Terminal 10 — assistant (8004) — FraudAware Assistant (needs services/assistant/.env)
cd services\assistant
py -m uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
```

---

## Frontends

```powershell
# Dashboard (3000)
cd fraudaware-dashboard
npm run dev

# Mobile (Expo)
cd FraudAware
npm start
```

The assistant screen (robot button on Home) needs `EXPO_PUBLIC_ASSISTANT_API_BASE_URL` in
`FraudAware/.env`, e.g. `http://192.168.1.250:8004` (your PC's Wi-Fi IP, no trailing slash).
Restart Expo after changing it.

---

## Tests — all at once (repo root)

```powershell
cd C:\Users\kanth\OneDrive\Desktop\R26-SE-002
npm test
```

| Command | What it runs |
|---------|----------------|
| `npm test` | All Python (`pytest`) + all Node services (Vitest) |
| `npm run test:ml` | Python only — `py -m pytest tests/ -v` |
| `npm run test:node` | All 5 Node microservices only |
| `npm run test:watch` | Vitest watch on **user-management** (default) |
| `npm run test:watch -- job-management` | Watch one service (pass name after `--`) |

PowerShell scripts (same as above): `scripts\test-all.ps1`, `scripts\test-node.ps1`, `scripts\test-watch.ps1`

---

## Tests — Python (pytest)

From repo root:

```powershell
npm run test:ml
```

Or per component:

```powershell
py -m pytest tests/scam_detection/ -v
py -m pytest tests/fake_job_detection/ -v
py -m pytest tests/employer_verification/ -v
py -m pytest tests/job_recommendation/ -v
```

---

## Tests — Node (Vitest)

All services from root:

```powershell
npm run test:node
```

Single service:

```powershell
cd services\user-management
npm test
```

Watch mode (one service at a time):

```powershell
npm run test:watch
npm run test:watch -- chat-management
```

---

## Port quick reference

| Port | Service |
|------|---------|
| 5000 | user-management |
| 5001 | job-management |
| 5002 | notification-management |
| 5003 | chat-management |
| 5004 | email-management |
| 5672 | RabbitMQ |
| 8000 | scam-detection |
| 8001 | employer-verification |
| 8002 | job-recommendation |
| 8003 | fake-job-detection |
| 8004 | assistant |
| 3000 | fraudaware-dashboard |
