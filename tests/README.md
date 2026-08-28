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
pytest tests/ -v
```

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

CI/CD should run `pytest tests/` after these suites exist.
Deploy comes after CI is green.
