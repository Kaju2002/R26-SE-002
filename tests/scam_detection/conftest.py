"""
Pytest setup for scam-detection tests.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

SCAM_DIR = Path(__file__).resolve().parents[0]
FIXTURES = SCAM_DIR / "fixtures" / "samples.json"


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
