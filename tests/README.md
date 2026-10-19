# FraudAware — Testing Layer

Dedicated test structure for the four ML / detection components.
Use this folder to explain **Unit → API → Metrics** to the panel.

## Components

| Folder | Service | Focus |
|--------|---------|--------|
| `scam_detection/` | `services/scam-detection` | Message / chat scam classify |
| `fake_job_detection/` | `services/fake-job-detection` | Fake vs real job posts |
| `employer_verification/` | `services/employer-verification` | Employer risk / legitimacy |
| `job_recommendation/` | `services/job-recommendation` | Ranking + Precision@K / Recall |
| `chat/` | mobile / chat helpers | Optional pure-function tests (e.g. thread risk) |
| `reports/` | generated outputs | Metrics tables / screenshots for viva |

## Layout per component

- `unit/` — model logic, scoring, preprocessing (no network)
- `api/` — FastAPI endpoint smoke tests (`TestClient`)
- `fixtures/` — fixed sample inputs (reproducible demos)
- `metrics/` — evaluation scripts / metric assertions (recommendation)

## How to run (after tests are added)

From repo root:

```bash
py -m pytest tests/ -v
```

Service imports (`app`, `main`, `src`) are isolated via `tests/service_imports.py` so the full suite can run in one command.

One component only:

```bash
pytest tests/scam_detection/ -v
```

## Order we fill tests

1. `scam_detection` ← done (fixtures + unit + mocked API)
2. `fake_job_detection` ← done (fixtures + unit + mocked API)
3. `employer_verification` ← done (fixtures + unit + mocked API)
4. `job_recommendation` ← done (fixtures + unit + mocked API + metrics)
5. Optional `chat/` helpers

### Run scam-detection tests

```bash
pip install -r tests/requirements.txt
pip install -r services/scam-detection/requirements.txt   # for app imports (torch, fastapi, …)
pytest tests/scam_detection/ -v
```

- **Unit** (`combine`, thresholds, explanations) — always run, no weights needed  
- **API** — mocked model/DB  
- **Integration** (`test_predict_integration.py`) — skips if model files missing  

### Run fake-job-detection tests

```bash
cd C:\Users\kanth\OneDrive\Desktop\R26-SE-002
py -m pytest tests/fake_job_detection/ -v
```

- **Unit** — `decide_from_probabilities` bands + explain helpers  
- **API** — mocked `/health` + `/predict-text`  
- **Integration** — skips unless `fake_job_model` weight files exist  

### Run employer-verification tests

```bash
cd C:\Users\kanth\OneDrive\Desktop\R26-SE-002
py -m pytest tests/employer_verification/ -v
```

- **Unit** — scoring layer, content flags, review helpers  
- **API** — mocked `/predict` (no real `.pkl` or web scraping)  
- **Integration** — skips unless `models/final_realistic_model.pkl` exists  

### Run job-recommendation tests

```bash
cd C:\Users\kanth\OneDrive\Desktop\R26-SE-002
py -m pytest tests/job_recommendation/ -v
```

- **Unit** — skill matching, risk aggregation, TOPSIS ranking, live ranking  
- **API** — mocked `/recommend` + real `/recommend/live`  
- **Metrics** — Precision@K / Recall@K helpers for viva  
- **Integration** — skips unless `services/job-recommendation/data/raw/*.csv` exist  


## Notes for panel

- Fixtures = controlled cases (not random live data)
- Unit tests = correctness of logic
- API tests = service contract (`/classify`, `/predict`, …)
- Metrics = research evaluation (precision / recall / F1)

CI runs only the suite for the service that changed. A shared file (`pytest.ini`, `tests/requirements.txt`, `tests/service_imports.py`) runs every Python suite. Deploy comes after CI is green.

### GitHub Actions CI

Each service has its own workflow file under `.github/workflows/`. A pull request or push to `main` / `master` starts only the workflows whose paths changed.

| Workflow | File | Command |
|----------|------|---------|
| Scam detection CI | `scam-detection.yml` | `python -m pytest tests/scam_detection -v` |
| Fake job detection CI | `fake-job-detection.yml` | `python -m pytest tests/fake_job_detection -v` |
| Employer verification CI | `employer-verification.yml` | `python -m pytest tests/employer_verification -v` |
| Job recommendation CI | `job-recommendation.yml` | `python -m pytest tests/job_recommendation -v` |
| Assistant CI | `assistant.yml` | `python -m pytest tests/assistant -v` |
| User management CI | `user-management.yml` | `npm test` |
| Chat management CI | `chat-management.yml` | `npm test` |
| Job management CI | `job-management.yml` | `npm test` |
| Notification management CI | `notification-management.yml` | `npm test` |
| Email management CI | `email-management.yml` | `npm test` |

No MongoDB, SMTP, or model weight files required — integration tests skip automatically.
