"""
Pytest setup for fake-job-detection tests.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

FAKE_JOB_TESTS = Path(__file__).resolve().parents[0]
FIXTURES = FAKE_JOB_TESTS / "fixtures" / "samples.json"


@pytest.fixture(scope="session")
def samples() -> dict:
    with FIXTURES.open(encoding="utf-8") as f:
        return json.load(f)
