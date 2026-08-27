"""
Pytest setup for scam-detection tests.
Adds services/scam-detection to sys.path so `import app...` works.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCAM_DIR = Path(__file__).resolve().parents[0]
TESTS_DIR = SCAM_DIR.parent
REPO_ROOT = TESTS_DIR.parent
SERVICE_ROOT = REPO_ROOT / "services" / "scam-detection"
FIXTURES = SCAM_DIR / "fixtures" / "samples.json"

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))


@pytest.fixture(scope="session")
def samples() -> dict:
    with FIXTURES.open(encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="session")
def scam_texts(samples: dict) -> list[str]:
    return [row["text"] for row in samples["scam_samples"]]


@pytest.fixture(scope="session")
def safe_texts(samples: dict) -> list[str]:
    return [row["text"] for row in samples["safe_samples"]]
