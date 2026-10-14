"""
Unit tests for the assistant's tool adapters (app/tools/*). Every service is faked with
httpx.MockTransport, so nothing needs to be running.
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff" + b"\x00" * 32


@pytest.fixture(scope="module")
def tools():
    from tests.service_imports import import_module

    import_module("assistant", "app.config").get_settings.cache_clear()
    job_post = import_module("assistant", "app.tools.job_post")
    company = import_module("assistant", "app.tools.company")
    recruiter = import_module("assistant", "app.tools.recruiter_chat")
    return job_post, company, recruiter


class FakeService:
    """Records requests and answers with a fixed response (or raises a transport error)."""

    def __init__(self, status=200, body=None, raise_error=None):
        self.status = status
        self.body = body if body is not None else {}
        self.raise_error = raise_error
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.raise_error is not None:
            raise self.raise_error(request)
        return httpx.Response(self.status, json=self.body)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler))


def run(coro):
    return asyncio.run(coro)


def _connect_error(request):
    return httpx.ConnectError("connection refused", request=request)


def _timeout_error(request):
    return httpx.ReadTimeout("timed out", request=request)


@pytest.fixture(autouse=True)
def offline_dns(tools, monkeypatch):
    """Website and email domains resolve to a public address without a real DNS lookup."""
    _, company, _ = tools

    async def resolve(host):
        return ["93.184.216.34"]

    monkeypatch.setattr(company.url_safety, "resolve", resolve)


# ─── JOB POST ────────────────────────────────────────────────────

JOB_TEXT = "Earn Rs 5,000 daily from home, pay registration fee to start."


@pytest.mark.parametrize(
    "prediction, fake, legit, risk, phrase",
    [
        ("fake", 0.93, 0.07, "high", "likely fake (93% fake probability)"),
        ("suspicious", 0.72, 0.28, "medium", "suspicious patterns (72% fake probability)"),
        ("legitimate", 0.12, 0.88, "low", "no strong signs of a fake job (88% legitimate probability)"),
    ],
)
def test_job_text_maps_prediction_to_risk(tools, prediction, fake, legit, risk, phrase):
    job_post, _, _ = tools
    svc = FakeService(body={"prediction": prediction, "fake_probability": fake, "legitimate_probability": legit})

    result = run(job_post.check_job_post_text(JOB_TEXT, client=svc.client()))

    assert (result.status, result.risk) == ("done", risk)
    assert phrase in result.reasons[0]
    assert svc.requests[0].url.path == "/predict-text"
    assert json.loads(svc.requests[0].content) == {"text": JOB_TEXT}


def test_job_text_too_short_is_not_sent(tools):
    job_post, _, _ = tools
    svc = FakeService()

    result = run(job_post.check_job_post_text("  hi  ", client=svc.client()))

    assert (result.status, result.risk) == ("failed", "unknown")
    assert "too short" in result.reasons[0]
    assert svc.requests == []


def test_job_image_includes_warning_signs_and_ocr_text(tools):
    job_post, _, _ = tools
    svc = FakeService(body={
        "prediction": "fake",
        "fake_probability": 0.95,
        "legitimate_probability": 0.05,
        "fake_signals_found": ["Registration fee required", "WhatsApp only contact"],
        "extracted_text": "Pay registration fee",
    })

    result = run(job_post.check_job_post_image(PNG, client=svc.client()))

    assert result.risk == "high"
    assert "Warning sign in the post: Registration fee required." in result.reasons
    assert result.details["extracted_text"] == "Pay registration fee"
    request = svc.requests[0]
    assert request.url.path == "/predict"
    assert b'name="image"' in request.content
    assert b"image/png" in request.content


def test_job_image_with_too_little_text_fails(tools):
    job_post, _, _ = tools
    svc = FakeService(body={"prediction": "skipped", "extracted_text": "Hi"})

    result = run(job_post.check_job_post_image(JPEG, client=svc.client()))

    assert result.status == "failed"
    assert "too little text" in result.reasons[0]


BAD_IMAGES = {
    "empty": (lambda: b"", "empty"),
    "gif": (lambda: b"GIF89a" + b"\x00" * 20, "Only JPEG, PNG or WebP"),
    "too_large": (lambda: PNG + b"\x00" * (5 * 1024 * 1024), "5 MB"),
}


@pytest.mark.parametrize("case", list(BAD_IMAGES))
def test_bad_images_are_rejected_before_upload(tools, case):
    job_post, _, recruiter = tools
    make, problem = BAD_IMAGES[case]
    data = make()
    svc = FakeService()

    job = run(job_post.check_job_post_image(data, client=svc.client()))
    msg = run(recruiter.check_recruiter_image(data, auth_token="t", client=svc.client()))

    assert problem in job.reasons[0]
    assert problem in msg.reasons[0]
    assert svc.requests == []


# ─── SERVICE FAILURES (shared by all adapters) ───────────────────


@pytest.mark.parametrize(
    "svc, phrase",
    [
        (FakeService(raise_error=_connect_error), "not available right now"),
        (FakeService(raise_error=_timeout_error), "took too long"),
        (FakeService(status=500, body={"detail": "Model inference failed: CUDA"}), "not available right now"),
        (FakeService(body=["not", "a", "dict"]), "could not read"),
    ],
)
def test_service_failures_become_unknown_without_crashing(tools, svc, phrase):
    job_post, _, _ = tools

    result = run(job_post.check_job_post_text(JOB_TEXT, client=svc.client()))

    assert (result.status, result.risk) == ("failed", "unknown")
    assert phrase in result.reasons[0]
    assert "CUDA" not in result.reasons[0]


# ─── COMPANY ─────────────────────────────────────────────────────


def _employer_body(band, checks=(), notices=(), headline="Headline"):
    return {
        "prediction": "x",
        "risk_level": band,
        "user_result": {
            "band": band,
            "label": "label",
            "score": 40,
            "headline": headline,
            "checks": list(checks),
            "notices": list(notices),
            "next_steps": ["Do not pay any fee."],
        },
    }


def test_company_high_lists_concerns(tools):
    _, company, _ = tools
    svc = FakeService(body=_employer_body(
        "High",
        checks=[
            {"name": "Official registration", "status": "concern", "detail": "No official registration was found."},
            {"name": "Reviews and scam reports", "status": "concern", "detail": "Scam reports were found online."},
            {"name": "Website", "status": "good", "detail": "Has an about page."},
        ],
        headline="This employer shows strong signs of fraud",
    ))

    result = run(company.check_company("ABC Holdings", None, "abc.jobs@gmail.com", client=svc.client()))

    assert result.risk == "high"
    assert result.reasons == [
        "This employer shows strong signs of fraud",
        "No official registration was found.",
        "Scam reports were found online.",
    ]
    assert json.loads(svc.requests[0].content) == {
        "company_name": "ABC Holdings",
        "website_url": None,
        "email": "abc.jobs@gmail.com",
    }


def test_company_low_lists_good_evidence(tools):
    _, company, _ = tools
    svc = FakeService(body=_employer_body(
        "Low",
        checks=[{"name": "Website", "status": "good", "detail": "Professional website."}],
        headline="This employer looks legitimate",
    ))

    result = run(company.check_company("Dialog Axiata PLC", "https://www.dialog.lk", client=svc.client()))

    assert result.risk == "low"
    assert result.reasons == ["This employer looks legitimate", "Professional website."]


def test_company_private_website_and_email_are_not_passed_on(tools):
    _, company, _ = tools
    svc = FakeService(body=_employer_body("Medium", headline="Some concerns"))

    result = run(company.check_company("ABC", "http://192.168.1.1/admin", "hr@127.0.0.1", client=svc.client()))

    assert json.loads(svc.requests[0].content) == {"company_name": "ABC", "website_url": None, "email": None}
    assert result.reasons[-2:] == [
        "The website was not checked because it points to a private network.",
        "The email address was not checked because it points to a private network.",
    ]


def test_company_with_only_an_unsafe_website_fails_without_calling_the_service(tools):
    _, company, _ = tools
    svc = FakeService()

    result = run(company.check_company(None, "http://localhost:8001/predict", client=svc.client()))

    assert result.status == "failed"
    assert result.reasons == [
        "The website was not checked because only the normal web ports can be checked. "
        "Please send the company name instead."
    ]
    assert svc.requests == []


def test_company_medium_includes_low_confidence_notice(tools):
    _, company, _ = tools
    svc = FakeService(body=_employer_body(
        "Medium", notices=["Little information was available for this check, so the result is less reliable."],
    ))

    result = run(company.check_company("Small Co", client=svc.client()))

    assert result.risk == "medium"
    assert result.reasons[-1].startswith("Little information was available")


def test_company_unknown_band_is_done_but_unknown(tools):
    _, company, _ = tools
    svc = FakeService(body=_employer_body("Unknown", headline="Not enough information to check this employer"))

    result = run(company.check_company("X", client=svc.client()))

    assert (result.status, result.risk) == ("done", "unknown")


def test_company_needs_at_least_one_detail(tools):
    _, company, _ = tools
    svc = FakeService()

    result = run(company.check_company("  ", None, "", client=svc.client()))

    assert result.status == "failed"
    assert "at least the company name" in result.reasons[0]
    assert svc.requests == []


def test_company_rejects_overlong_fields(tools):
    _, company, _ = tools
    svc = FakeService()

    result = run(company.check_company("A" * 201, client=svc.client()))

    assert result.status == "failed"
    assert svc.requests == []


def test_company_timeout_is_reported(tools):
    _, company, _ = tools
    svc = FakeService(raise_error=_timeout_error)

    result = run(company.check_company("ABC", client=svc.client()))

    assert result.status == "failed"
    assert "company check took too long" in result.reasons[0]


# ─── RECRUITER MESSAGES ──────────────────────────────────────────


def _scam_body(label, tactics=(), warning=None, explanation=None):
    return {
        "label": label,
        "confidence": 88,
        "tactics": list(tactics),
        "warning": warning,
        "what_gave_it_away": explanation,
        "scan_id": "abc123",
    }


def test_recruiter_scam_lists_tactics_and_forwards_token(tools):
    _, _, recruiter = tools
    svc = FakeService(body=_scam_body(
        "SCAM DETECTED",
        tactics=[{"key": "urgency", "name": "Urgency Pressure", "score": 0.9, "description": "..."},
                 {"key": "sunk_cost", "name": "Sunk Cost", "score": 0.7, "description": "..."}],
        warning="Legitimate employers never ask for fees.",
        explanation="The words 'today' and 'fee' triggered Urgency Pressure.",
    ))

    result = run(recruiter.check_recruiter_text("Pay the fee today", auth_token="user-jwt", client=svc.client()))

    assert result.risk == "high"
    assert result.reasons[0] == "Manipulation tactics found: Urgency Pressure, Sunk Cost."
    assert "Legitimate employers never ask for fees." in result.reasons
    assert [t["key"] for t in result.details["tactics"]] == ["urgency", "sunk_cost"]
    request = svc.requests[0]
    assert request.url.path == "/classify"
    assert request.headers["Authorization"] == "Bearer user-jwt"


def test_recruiter_suspicious_and_legitimate(tools):
    _, _, recruiter = tools
    suspicious = FakeService(body=_scam_body("SUSPICIOUS", warning="Some scam-like signals."))
    legit = FakeService(body=_scam_body("LEGITIMATE"))

    r1 = run(recruiter.check_recruiter_text("Hello", auth_token="t", client=suspicious.client()))
    r2 = run(recruiter.check_recruiter_text("Hello", auth_token="t", client=legit.client()))

    assert (r1.risk, r1.reasons) == ("medium", ["Some scam-like signals."])
    assert r2.risk == "low"
    assert "No manipulation tactics" in r2.reasons[0]


def test_recruiter_long_text_keeps_the_latest_2000_chars(tools):
    _, _, recruiter = tools
    svc = FakeService(body=_scam_body("LEGITIMATE"))
    text = "old " * 600 + "PAY THE FEE NOW"

    result = run(recruiter.check_recruiter_text(text, auth_token="t", client=svc.client()))

    sent = json.loads(svc.requests[0].content)["text"]
    assert len(sent) == 2000
    assert sent.endswith("PAY THE FEE NOW")
    assert result.details["truncated"] is True
    assert result.reasons[-1] == "Only the last 2,000 characters were checked."


def test_recruiter_without_login_reports_it(tools):
    _, _, recruiter = tools
    svc = FakeService(status=401, body={"detail": "No token provided. Please login."})

    result = run(recruiter.check_recruiter_text("Hello there", auth_token=None, client=svc.client()))

    assert result.status == "failed"
    assert "needs you to be logged in" in result.reasons[0]
    assert "Authorization" not in svc.requests[0].headers


def test_recruiter_rate_limit_is_reported(tools):
    _, _, recruiter = tools
    svc = FakeService(status=429, body={"detail": "Too many scans."})

    result = run(recruiter.check_recruiter_text("Hello there", auth_token="t", client=svc.client()))

    assert "wait a minute" in result.reasons[0]


def test_recruiter_image_uses_file_field_and_keeps_ocr_text(tools):
    _, _, recruiter = tools
    body = {**_scam_body("SCAM DETECTED", warning="Fee request."), "extracted_text": "send fee"}
    svc = FakeService(body=body)

    result = run(recruiter.check_recruiter_image(JPEG, auth_token="t", client=svc.client()))

    assert result.risk == "high"
    assert result.details["extracted_text"] == "send fee"
    request = svc.requests[0]
    assert request.url.path == "/classify-image"
    assert b'name="file"' in request.content


def test_recruiter_image_without_text_asks_to_paste(tools):
    _, _, recruiter = tools
    svc = FakeService(status=400, body={"detail": "No text found"})

    result = run(recruiter.check_recruiter_image(PNG, auth_token="t", client=svc.client()))

    assert "paste the messages instead" in result.reasons[0]


def test_recruiter_empty_text_is_not_sent(tools):
    _, _, recruiter = tools
    svc = FakeService()

    result = run(recruiter.check_recruiter_text("   ", auth_token="t", client=svc.client()))

    assert result.status == "failed"
    assert svc.requests == []
