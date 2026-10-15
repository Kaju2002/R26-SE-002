"""
Settings for every assistant test: never touch a real MongoDB (the local .env may have a
MONGO_URI), and no rate limits unless a test sets its own.
"""

import pytest


@pytest.fixture(autouse=True)
def assistant_test_env(monkeypatch):
    monkeypatch.setenv("MONGO_URI", "")
    for name in ("RATE_LIMIT_PER_MINUTE", "RATE_LIMIT_PER_DAY", "LLM_CALLS_PER_MINUTE", "LLM_CALLS_PER_USER_PER_DAY"):
        monkeypatch.setenv(name, "0")
