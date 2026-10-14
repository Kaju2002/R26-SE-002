"""
Unit tests for website / email safety before the company check: addresses pointing to a
private network are never passed to employer-verification. DNS is faked.
"""

from __future__ import annotations

import asyncio

import pytest

DNS = {
    "dialog.lk": ["203.94.66.1"],
    "www.dialog.lk": ["203.94.66.1"],
    "gmail.com": ["142.250.4.17"],
    "intranet.example.com": ["10.0.0.5"],
    "rebind.example.com": ["93.184.216.34", "127.0.0.1"],
    "v6local.example.com": ["fe80::1%12"],
}


@pytest.fixture
def url_safety(monkeypatch):
    from tests.service_imports import import_module

    module = import_module("assistant", "app.url_safety")

    async def resolve(host):
        return DNS.get(host, [])

    monkeypatch.setattr(module, "resolve", resolve)
    return module


def _website(module, url):
    return asyncio.run(module.website_problem(url))


@pytest.mark.parametrize(
    "url",
    [
        "https://www.dialog.lk/careers",
        "dialog.lk",
        "http://dialog.lk:443",
        "http://8.8.8.8",
        "unknown-name-that-does-not-resolve.lk",
    ],
)
def test_public_websites_are_allowed(url_safety, url):
    assert _website(url_safety, url) is None


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1",
        "http://127.1",
        "http://2130706433",
        "http://0x7f000001",
        "http://[::1]/",
        "http://10.1.2.3",
        "http://172.16.0.1",
        "http://192.168.1.250",
        "http://169.254.169.254/latest/meta-data",
        "http://0.0.0.0",
        "localhost",
        "printer.local",
        "service.internal",
        "intranet",
        "intranet.example.com",
        "rebind.example.com",
        "v6local.example.com",
    ],
)
def test_private_addresses_are_blocked(url_safety, url):
    assert _website(url_safety, url) == "it points to a private network"


@pytest.mark.parametrize(
    "url, problem",
    [
        ("ftp://dialog.lk", "only http and https addresses can be checked"),
        ("file:///etc/passwd", "only http and https addresses can be checked"),
        ("http://dialog.lk:8080", "only the normal web ports can be checked"),
        ("http://dialog.lk:99999", "it is not a valid web address"),
        ("http://admin@dialog.lk", "it is not a valid web address"),
    ],
)
def test_other_unsafe_addresses(url_safety, url, problem):
    assert _website(url_safety, url) == problem


def test_email_domains(url_safety):
    assert asyncio.run(url_safety.email_problem("jobs@gmail.com")) is None
    assert asyncio.run(url_safety.email_problem("hr@192.168.0.10")) == "it points to a private network"
    assert asyncio.run(url_safety.email_problem("hr@intranet.example.com")) == "it points to a private network"
