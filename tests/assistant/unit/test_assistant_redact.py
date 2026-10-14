"""
Unit tests for masking personal data before text is sent to the LLM.
"""

from __future__ import annotations

import pytest


@pytest.fixture(scope="module")
def redact():
    from tests.service_imports import import_module

    return import_module("assistant", "app.redact").redact


# ─── MASKED ──────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "text, expected",
    [
        # Sri Lankan mobile and landline numbers in common formats
        ("Call 0771234567 now", "Call [PHONE] now"),
        ("Call 077 123 4567 now", "Call [PHONE] now"),
        ("Call 077-123-4567 now", "Call [PHONE] now"),
        ("Call 077 1234567 now", "Call [PHONE] now"),
        ("WhatsApp +94771234567", "WhatsApp [PHONE]"),
        ("WhatsApp +94 77 123 4567", "WhatsApp [PHONE]"),
        ("WhatsApp 0094 77 123 4567", "WhatsApp [PHONE]"),
        ("WhatsApp 94771234567", "WhatsApp [PHONE]"),
        ("Office 0112 345 678", "Office [PHONE]"),
        ("Office (011) 234-5678", "Office [PHONE]"),
        ("Dubai agent +971 50 123 4567", "Dubai agent [PHONE]"),
        # NIC, old and new formats
        ("Send NIC 951234567V", "Send NIC [NIC]"),
        ("Send NIC 951234567v", "Send NIC [NIC]"),
        ("nic no: 199512345678", "nic no: [NIC]"),
        # Bank accounts and cards
        ("Pay to account 8001234567", "Pay to account [ACCOUNT]"),
        ("A/C No: 1234-5678-90", "A/C No: [ACCOUNT]"),
        ("acc 123456", "acc [ACCOUNT]"),
        ("Card 4111 1111 1111 1111", "Card [ACCOUNT]"),
        ("4111-1111-1111-1111 expires soon", "[ACCOUNT] expires soon"),
        ("deposit to 80012345678 today", "deposit to [ACCOUNT] today"),
        # OTP and PIN codes
        ("Your OTP is 482913", "Your OTP is [CODE]"),
        ("OTP: 4829", "OTP: [CODE]"),
        ("Send me the PIN 1234", "Send me the PIN [CODE]"),
        ("verification code 55721", "verification code [CODE]"),
        ("482913 is your OTP", "[CODE] is your OTP"),
    ],
)
def test_masks_personal_data(redact, text, expected):
    assert redact(text).text == expected


def test_email_keeps_domain(redact):
    result = redact("Email hr.abcjobs@gmail.com or careers@dialog.lk")
    assert result.text == "Email [EMAIL]@gmail.com or [EMAIL]@dialog.lk"
    assert result.counts == {"email": 2}


# ─── KEPT ────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "text",
    [
        "Pay a registration fee of Rs 2,500 today",
        "Salary LKR 150,000 per month",
        "Earn Rs.5000 daily",
        "Fee 2500/- only",
        "Salary 85,000 rupees",
        "Interview on 2026-10-14 at 10.30 am",
        "Start date 14/10/2026",
        "Only 2 seats left, 5 years experience needed",
        "Apply at www.abc-jobs.lk/apply?id=1234567890",
        "Visit https://careers.dialog.lk/jobs/80012345678",
        "Our site is abcholdings.com",
        "Reference number 12345",
        "We have 1500 employees and 25 branches",
    ],
)
def test_keeps_money_dates_websites_and_small_numbers(redact, text):
    result = redact(text)
    assert result.text == text
    assert result.total == 0


# ─── WHOLE MESSAGES ──────────────────────────────────────────────


def test_recruiter_message(redact):
    text = (
        "Congratulations! Call Mr. Perera on 077 123 4567 or email hr.abcjobs@gmail.com. "
        "Pay Rs 2,500 to account 8001234567 and send your NIC 951234567V. "
        "Details at www.abc-jobs.lk"
    )

    result = redact(text)

    assert result.text == (
        "Congratulations! Call Mr. Perera on [PHONE] or email [EMAIL]@gmail.com. "
        "Pay Rs 2,500 to account [ACCOUNT] and send your NIC [NIC]. "
        "Details at www.abc-jobs.lk"
    )
    assert result.counts == {"phone": 1, "email": 1, "account": 1, "nic": 1}
    assert result.total == 4


def test_nothing_to_mask(redact):
    result = redact("Hello, is this job real?")
    assert result.text == "Hello, is this job real?"
    assert result.counts == {}


def test_empty_text(redact):
    assert redact("").text == ""


def test_masking_twice_changes_nothing(redact):
    once = redact("Call 0771234567, OTP 4829, NIC 951234567V, mail a@b.lk").text
    assert redact(once).text == once
