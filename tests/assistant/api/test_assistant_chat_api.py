"""
API tests for the assistant chat in guided (button) mode: POST /assistant/message and
GET /assistant/session/{id}. The three checks are faked; nothing else needs to run.
"""

from __future__ import annotations

import asyncio
import time

import httpx
import jwt
import pytest

SECRET = "test-jwt-secret-that-is-at-least-32-bytes"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def _token(user_id: str = "user-a") -> str:
    now = int(time.time())
    return jwt.encode({"userId": user_id, "iat": now, "exp": now + 600}, SECRET, algorithm="HS256")


@pytest.fixture
def chat(monkeypatch):
    from tests.service_imports import import_module

    monkeypatch.setenv("JWT_SECRET", SECRET)
    import_module("assistant", "app.config").get_settings.cache_clear()
    main = import_module("assistant", "app.main")
    main.store.clear()
    yield Chat(main, monkeypatch)
    main.store.clear()


class Chat:
    """Talks to the app in-process and fakes the three checks."""

    def __init__(self, main, monkeypatch):
        self.main = main
        self.guided = main.guided
        self.CheckResult = self.guided.CheckResult
        self.calls: list[tuple] = []
        self.results = {
            "job_post": self.done("job_post", "high", "Likely fake."),
            "company": self.done("company", "high", "Could not verify."),
            "recruiter_chat": self.done("recruiter_chat", "high", "Asks for a fee."),
        }
        g = self.guided

        async def job_text(text):
            self.calls.append(("job_post", "text", text))
            return self.results["job_post"]

        async def job_image(image):
            self.calls.append(("job_post", "image", len(image)))
            return self.results["job_post"]

        async def company(company_name=None, website_url=None, email=None):
            self.calls.append(("company", company_name, website_url, email))
            return self.results["company"]

        async def recruiter_text(text, *, auth_token):
            self.calls.append(("recruiter_chat", "text", text, auth_token))
            return self.results["recruiter_chat"]

        async def recruiter_image(image, *, auth_token):
            self.calls.append(("recruiter_chat", "image", len(image), auth_token))
            return self.results["recruiter_chat"]

        monkeypatch.setattr(g, "check_job_post_text", job_text)
        monkeypatch.setattr(g, "check_job_post_image", job_image)
        monkeypatch.setattr(g, "check_company", company)
        monkeypatch.setattr(g, "check_recruiter_text", recruiter_text)
        monkeypatch.setattr(g, "check_recruiter_image", recruiter_image)

    def done(self, source, risk, *reasons):
        return self.CheckResult(source=source, status="done", risk=risk, reasons=list(reasons))

    def request(self, method, path, token=None, **kwargs) -> httpx.Response:
        headers = {"Authorization": f"Bearer {token or _token()}"}

        async def run():
            transport = httpx.ASGITransport(app=self.main.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.request(method, path, headers=headers, **kwargs)

        return asyncio.run(run())

    def send(self, session_id=None, *, text=None, chip=None, image=None, token=None) -> dict:
        data = {k: v for k, v in {"session_id": session_id, "text": text, "chip": chip}.items() if v is not None}
        files = {"image": ("shot.png", image, "image/png")} if image is not None else None
        res = self.request("POST", "/assistant/message", token=token, data=data, files=files)
        assert res.status_code == 200, res.text
        return res.json()


def _chip_ids(body: dict) -> list[str]:
    return [c["id"] for c in body["chips"]]


def _status(body: dict) -> dict:
    return {c["source"]: c["status"] for c in body["checks"]}


# ─── AUTH ────────────────────────────────────────────────────────


def test_requires_login(chat):
    async def run():
        transport = httpx.ASGITransport(app=chat.main.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post("/assistant/message")

    assert asyncio.run(run()).status_code == 401


def test_rejects_token_signed_with_another_secret(chat):
    bad = jwt.encode({"userId": "x"}, "another-secret-that-is-also-32-bytes-long", algorithm="HS256")
    res = chat.request("POST", "/assistant/message", token=bad)
    assert res.status_code == 401


# ─── START ───────────────────────────────────────────────────────


def test_start_greets_with_menu(chat):
    body = chat.send()

    assert body["session_id"]
    assert body["reply"].startswith("Hi! I'm the FraudAware Assistant.")
    assert _chip_ids(body) == ["check_job_post", "check_company", "check_recruiter"]
    assert body["awaiting"] == "menu"
    assert set(_status(body).values()) == {"missing"}


# ─── FULL FLOWS ──────────────────────────────────────────────────


def test_full_scam_flow_job_post_company_recruiter(chat):
    sid = chat.send()["session_id"]

    body = chat.send(sid, chip="check_job_post")
    assert body["awaiting"] == "job_post"

    body = chat.send(sid, text="Earn Rs 5,000 daily, pay registration fee")
    assert "Job post check: shows strong warning signs." in body["reply"]
    assert "Next, let's check the company." in body["reply"]
    assert body["awaiting"] == "company"

    body = chat.send(sid, text="ABC Holdings, abc.jobs@gmail.com")
    assert ("company", "ABC Holdings", None, "abc.jobs@gmail.com") in chat.calls
    assert body["awaiting"] == "recruiter_question"
    assert _chip_ids(body) == ["recruiter_yes", "recruiter_no", "skip"]

    body = chat.send(sid, chip="recruiter_yes")
    assert body["awaiting"] == "recruiter_chat"

    token = _token()
    body = chat.send(sid, text="Pay Rs 3000 today", token=token)
    assert ("recruiter_chat", "text", "Pay Rs 3000 today", token) in chat.calls
    assert body["awaiting"] == "finished"
    assert body["result"]["colour"] == "red"
    assert body["result"]["partial"] is False
    assert _chip_ids(body) == ["new_check"]


def test_legitimate_result_does_not_end_the_conversation(chat):
    chat.results["job_post"] = chat.done("job_post", "low", "No strong signs.")
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")

    body = chat.send(sid, text="Software engineer at Dialog, apply on careers page")

    assert "shows no strong warning signs" in body["reply"]
    assert "That looks fine so far" in body["reply"]
    assert body["awaiting"] == "company"
    assert body["result"] is None


def test_all_low_gives_green(chat):
    for source in ("job_post", "company", "recruiter_chat"):
        chat.results[source] = chat.done(source, "low", "Fine.")
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")
    chat.send(sid, text="A normal job post text here")
    chat.send(sid, text="Dialog Axiata PLC, www.dialog.lk")
    chat.send(sid, chip="recruiter_yes")

    body = chat.send(sid, text="Please attend the interview at our office on Monday.")

    assert body["result"]["colour"] == "green"


# ─── FLEXIBLE ORDER ──────────────────────────────────────────────


def test_content_first_asks_what_it_is_then_runs_that_check(chat):
    sid = chat.send()["session_id"]

    body = chat.send(sid, text="Send the training fee today or lose your seat")
    assert body["awaiting"] == "input_type"
    assert _chip_ids(body) == ["is_job_post", "is_recruiter", "is_company"]
    assert chat.calls == []

    body = chat.send(sid, chip="is_recruiter")
    assert chat.calls[0][:3] == ("recruiter_chat", "text", "Send the training fee today or lose your seat")
    assert _status(body)["recruiter_chat"] == "done"
    assert "Next, let's check the job post." in body["reply"]
    assert body["awaiting"] == "job_post"


def test_image_first_cannot_be_company_details(chat):
    sid = chat.send()["session_id"]

    body = chat.send(sid, image=PNG)

    assert _chip_ids(body) == ["is_job_post", "is_recruiter"]
    body = chat.send(sid, chip="is_job_post")
    assert chat.calls == [("job_post", "image", len(PNG))]


def test_start_with_company_then_job_post(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_company")

    body = chat.send(sid, text="Company: ABC Holdings")

    assert chat.calls == [("company", "ABC Holdings", None, None)]
    assert body["awaiting"] == "job_post"


# ─── SKIPS AND FAILURES ──────────────────────────────────────────


def test_skips_give_a_partial_result(chat):
    chat.results["job_post"] = chat.done("job_post", "low", "Fine.")
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")
    chat.send(sid, text="A normal job post text here")

    body = chat.send(sid, chip="skip")
    assert "skipped the company check" in body["reply"]
    assert body["awaiting"] == "recruiter_question"

    body = chat.send(sid, chip="recruiter_no")

    result = body["result"]
    assert result["colour"] == "grey"
    assert result["partial"] is True
    assert result["not_checked"] == ["company"]
    assert _status(body) == {"job_post": "done", "company": "skipped", "recruiter_chat": "not_applicable"}


def test_failed_check_can_be_retried(chat):
    failed = chat.CheckResult(source="job_post", status="failed", risk="unknown",
                              reasons=["The job post check is not available right now."])
    chat.results["job_post"] = failed
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")

    body = chat.send(sid, text="Some job post text here")
    assert "I couldn't complete the job post check" in body["reply"]
    assert body["awaiting"] == "job_post"
    assert _chip_ids(body) == ["skip"]

    chat.results["job_post"] = chat.done("job_post", "medium", "Some signs.")
    body = chat.send(sid, text="Some job post text here")
    assert body["awaiting"] == "company"


def test_company_image_asks_for_typed_details(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_company")

    body = chat.send(sid, image=PNG)

    assert "can't read company details from an image" in body["reply"]
    assert body["awaiting"] == "company"
    assert chat.calls == []


def test_recruiter_question_accepts_messages_directly(chat):
    chat.results["job_post"] = chat.done("job_post", "low", "Fine.")
    chat.results["company"] = chat.done("company", "low", "Fine.")
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")
    chat.send(sid, text="A normal job post text here")
    chat.send(sid, text="Dialog Axiata PLC")

    body = chat.send(sid, image=PNG)

    assert chat.calls[-1][:3] == ("recruiter_chat", "image", len(PNG))
    assert body["awaiting"] == "finished"
    assert body["result"]["colour"] == "red"


# ─── SESSIONS ────────────────────────────────────────────────────


def test_other_users_cannot_use_or_read_a_session(chat):
    sid = chat.send(token=_token("user-a"))["session_id"]
    other = _token("user-b")

    post = chat.request("POST", "/assistant/message", token=other, data={"session_id": sid, "text": "hi"})
    get = chat.request("GET", f"/assistant/session/{sid}", token=other)

    assert post.status_code == 404
    assert get.status_code == 404


def test_session_view_has_history_and_checks(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")
    chat.send(sid, text="Earn Rs 5,000 daily, pay registration fee")

    res = chat.request("GET", f"/assistant/session/{sid}")

    body = res.json()
    assert res.status_code == 200
    assert [m["role"] for m in body["messages"]] == ["assistant", "user", "assistant", "user", "assistant"]
    assert body["messages"][3]["text"] == "Earn Rs 5,000 daily, pay registration fee"
    assert body["awaiting"] == "company"


def test_new_check_after_result_starts_a_new_session(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_job_post")
    chat.send(sid, text="Earn Rs 5,000 daily, pay registration fee")
    chat.send(sid, chip="skip")
    finished = chat.send(sid, chip="skip")
    assert finished["awaiting"] == "finished"

    again = chat.send(sid, text="hello")
    assert "This check is finished" in again["reply"]

    new = chat.send(sid, chip="new_check")
    assert new["session_id"] != sid
    assert new["awaiting"] == "menu"


def test_unknown_session_is_404(chat):
    res = chat.request("POST", "/assistant/message", data={"session_id": "does-not-exist", "text": "hi"})
    assert res.status_code == 404


def test_overlong_message_is_rejected(chat):
    res = chat.request("POST", "/assistant/message", data={"text": "x" * 10_001})
    assert res.status_code == 413
