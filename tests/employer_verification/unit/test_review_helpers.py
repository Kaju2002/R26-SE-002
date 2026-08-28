"""Unit tests for review_aggregator helpers (no network)."""

from tests.service_imports import import_module

review_aggregator = import_module(
    "employer-verification",
    "app.employer_verification_model.review_aggregator",
)
normalize_company_name = review_aggregator.normalize_company_name
is_job_board_url = review_aggregator.is_job_board_url


def test_normalize_company_name_trims():
    assert normalize_company_name("  Virtusa  ") == "Virtusa"


def test_normalize_company_name_dedupes_paste():
    assert normalize_company_name("Anthem StudiosAnthem Studios") == "Anthem Studios"


def test_is_job_board_url_detects_topjobs():
    assert is_job_board_url("https://www.topjobs.lk/employer/123") is True


def test_is_job_board_url_allows_company_site():
    assert is_job_board_url("https://www.virtusa.com") is False


def test_is_job_board_url_empty():
    assert is_job_board_url("") is False
    assert is_job_board_url(None) is False
