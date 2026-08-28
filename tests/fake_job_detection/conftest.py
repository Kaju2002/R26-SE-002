"""
Pytest setup for fake-job-detection tests.
Adds services/fake-job-detection to sys.path so `import main` / `import explain` work.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

FAKE_JOB_TESTS = Path(__file__).resolve().parents[0]
TESTS_DIR = FAKE_JOB_TESTS.parent
REPO_ROOT = TESTS_DIR.parent
SERVICE_ROOT = REPO_ROOT / "services" / "fake-job-detection"
FIXTURES = FAKE_JOB_TESTS / "fixtures" / "samples.json"

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))


@pytest.fixture(scope="session")
def samples() -> dict:
    with FIXTURES.open(encoding="utf-8") as f:
        return json.load(f)
