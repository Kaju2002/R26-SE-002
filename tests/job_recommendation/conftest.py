"""
Pytest setup for job-recommendation tests.
Adds services/job-recommendation to sys.path so `import app` and `from src...` work.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

JR_TESTS = Path(__file__).resolve().parents[0]
TESTS_DIR = JR_TESTS.parent
REPO_ROOT = TESTS_DIR.parent
SERVICE_ROOT = REPO_ROOT / "services" / "job-recommendation"
FIXTURES = JR_TESTS / "fixtures"
SAMPLES_JSON = FIXTURES / "samples.json"
MINI_JOBS_CSV = FIXTURES / "mini_jobs.csv"
MINI_RISK_CSV = FIXTURES / "mini_risk.csv"
FULL_JOBS_CSV = SERVICE_ROOT / "data" / "raw" / "jobs.csv"
FULL_RISK_CSV = SERVICE_ROOT / "data" / "raw" / "risk_indicators.csv"

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))


@pytest.fixture(scope="session")
def samples() -> dict:
    with SAMPLES_JSON.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def mini_jobs_path() -> Path:
    return MINI_JOBS_CSV


@pytest.fixture(scope="session")
def mini_risk_path() -> Path:
    return MINI_RISK_CSV


@pytest.fixture(scope="session")
def full_dataset_ready() -> bool:
    return FULL_JOBS_CSV.is_file() and FULL_RISK_CSV.is_file()
