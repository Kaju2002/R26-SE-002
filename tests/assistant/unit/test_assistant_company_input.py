"""
Unit tests for splitting typed company details into name, website and email.
"""

from __future__ import annotations

import pytest


@pytest.fixture(scope="module")
def parse():
    from tests.service_imports import import_module

    return import_module("assistant", "app.company_input").parse_company_details


@pytest.mark.parametrize(
    "text, expected",
    [
        ("ABC Holdings, www.abc.lk, hr@abc.lk", ("ABC Holdings", "www.abc.lk", "hr@abc.lk")),
        ("ABC Holdings, abc.jobs@gmail.com", ("ABC Holdings", None, "abc.jobs@gmail.com")),
        ("Company: ABC Pvt.Ltd", ("ABC Pvt.Ltd", None, None)),
        ("hr@abc.lk", (None, None, "hr@abc.lk")),
        ("https://abc.com/careers", (None, "https://abc.com/careers", None)),
        ("Dialog Axiata PLC\nwebsite: dialog.lk", ("Dialog Axiata PLC", "dialog.lk", None)),
        ("  ", (None, None, None)),
    ],
)
def test_parse_company_details(parse, text, expected):
    result = parse(text)
    assert (result["company_name"], result["website_url"], result["email"]) == expected
