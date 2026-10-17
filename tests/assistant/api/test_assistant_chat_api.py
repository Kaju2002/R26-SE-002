"""
API tests for the assistant chat in guided (button) mode: POST /assistant/message and
GET /assistant/session/{id}. The three checks are faked; nothing else needs to run.
"""

from __future__ import annotations

import asyncio

import httpx
import jwt

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


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
    chat.settle()
    assert ("company", "ABC Holdings", None, "abc.jobs@gmail.com") in chat.calls
    assert body["awaiting"] == "recruiter_question"
    assert _chip_ids(body) == ["recruiter_yes", "recruiter_no", "skip"]

    body = chat.send(sid, chip="recruiter_yes")
    assert body["awaiting"] == "recruiter_chat"

    token = chat.token()
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
    chat.settle()
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


def test_off_topic_text_explains_what_can_be_checked(chat):
    sid = chat.send()["session_id"]

    body = chat.send(sid, text="Give me an essay")

    assert body["reply"].startswith("I can only check job posts, company details and recruiter messages")
    assert _chip_ids(body) == ["is_job_post", "is_recruiter", "is_company"]
    assert chat.calls == []


def test_off_topic_text_does_not_replace_what_was_sent_before(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, text="Send the training fee today or lose your seat")

    body = chat.send(sid, text="I want a love letter")
    assert body["reply"].startswith("I can only check job posts")
    assert body["awaiting"] == "input_type"

    chat.send(sid, chip="is_recruiter")
    assert chat.calls[0][:3] == ("recruiter_chat", "text", "Send the training fee today or lose your seat")


def test_typed_answer_checks_the_image_that_was_sent(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, image=PNG)

    body = chat.send(sid, text="I sent the job post could you please review that ?")

    assert chat.calls == [("job_post", "image", len(PNG))]
    assert _status(body)["job_post"] == "done"


def test_typed_answer_checks_the_text_that_was_sent(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, text="Send the training fee today or lose your seat")

    chat.send(sid, text="it's from the recruiter on WhatsApp")

    assert chat.calls[0][:3] == ("recruiter_chat", "text", "Send the training fee today or lose your seat")


def test_company_answer_for_an_image_asks_for_typed_details(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, image=PNG)

    body = chat.send(sid, text="it's the company details")

    assert body["reply"].startswith("I can't read company details from an image.")
    assert chat.calls == []


def test_content_with_type_words_is_new_content_not_an_answer(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, text="Send the training fee today or lose your seat")

    body = chat.send(sid, text="Company: ABC Holdings")

    assert body["awaiting"] == "input_type"
    assert chat.calls == []
    chat.send(sid, chip="is_company")
    chat.settle()
    assert chat.calls == [("company", "ABC Holdings", None, None)]


def test_short_company_name_can_still_be_checked_with_a_button(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, text="Kandy Traders")

    chat.send(sid, chip="is_company")
    chat.settle()

    assert [c[0] for c in chat.calls] == ["company"]


def test_greeting_gets_the_menu(chat):
    sid = chat.send()["session_id"]

    body = chat.send(sid, text="hello")

    assert body["reply"].startswith("Hi! I check job posts")
    assert body["awaiting"] == "menu"
    assert "check_job_post" in _chip_ids(body)


def test_start_with_company_then_job_post(chat):
    sid = chat.send()["session_id"]
    chat.send(sid, chip="check_company")

    body = chat.send(sid, text="Company: ABC Holdings")
    chat.settle()

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
    chat.settle()

    body = chat.send(sid, image=PNG)

    assert chat.calls[-1][:3] == ("recruiter_chat", "image", len(PNG))
    assert body["awaiting"] == "finished"
    assert body["result"]["colour"] == "red"


# ─── SESSIONS ────────────────────────────────────────────────────


def test_other_users_cannot_use_or_read_a_session(chat):
    sid = chat.send(token=chat.token("user-a"))["session_id"]
    other = chat.token("user-b")

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
    assert body["messages"][1]["text"] == "Job post"
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


# ─── BACKGROUND COMPANY CHECK ────────────────────────────────────


def _start_at(chat, chip: str) -> str:
    sid = chat.send()["session_id"]
    chat.send(sid, chip=chip)
    return sid


def test_company_check_runs_in_background_while_chat_goes_on(chat):
    chat.hold_company()
    sid = _start_at(chat, "check_company")

    body = chat.send(sid, text="ABC Holdings, abc.jobs@gmail.com")

    assert "I'm checking the company now" in body["reply"]
    assert "Next, let's check the job post." in body["reply"]
    assert body["awaiting"] == "job_post"
    assert body["running"] is True
    assert _status(body)["company"] == "running"

    chat.release_company()
    view = chat.session(sid)
    assert view["running"] is False
    assert _status(view)["company"] == "done"
    assert view["messages"][-1]["text"].startswith("Company check: shows strong warning signs.")
    assert view["awaiting"] == "job_post"


def test_result_waits_for_the_company_check(chat):
    chat.hold_company()
    sid = _start_at(chat, "check_company")
    chat.send(sid, text="ABC Holdings")
    chat.send(sid, text="Earn Rs 5,000 daily, pay registration fee")

    body = chat.send(sid, chip="recruiter_no")

    assert body["awaiting"] == "waiting"
    assert body["result"] is None
    assert "I'm still checking the company" in body["reply"]
    assert _chip_ids(body) == ["skip"]
    assert chat.send(sid, text="hello?")["awaiting"] == "waiting"

    chat.release_company()
    view = chat.session(sid)
    assert view["awaiting"] == "finished"
    assert view["result"]["colour"] == "red"
    assert _chip_ids(view) == ["new_check"]
    assert view["messages"][-1]["text"].startswith("Company check: shows strong warning signs.")
    assert view["messages"][-1]["text"].endswith("That's everything. Here is your result.")


def test_skip_while_waiting_gives_a_partial_result(chat):
    chat.hold_company()
    chat.results["job_post"] = chat.done("job_post", "low", "Fine.")
    sid = _start_at(chat, "check_company")
    chat.send(sid, text="ABC Holdings")
    chat.send(sid, text="A normal job post text here")
    chat.send(sid, chip="recruiter_no")

    body = chat.send(sid, chip="skip")

    assert "skipped the company check" in body["reply"]
    assert body["result"]["partial"] is True
    assert body["result"]["not_checked"] == ["company"]
    messages = len(chat.session(sid)["messages"])
    chat.release_company()
    view = chat.session(sid)
    assert _status(view)["company"] == "skipped"
    assert len(view["messages"]) == messages


def test_company_check_timeout_asks_again(chat, monkeypatch):
    monkeypatch.setenv("EMPLOYER_CHECK_TIMEOUT_SECONDS", "0.05")
    chat.guided.get_settings.cache_clear()
    monkeypatch.setattr(chat.guided.background, "GRACE_SECONDS", 0)
    chat.hold_company()
    sid = _start_at(chat, "check_recruiter")
    chat.send(sid, text="Pay Rs 3000 today")
    chat.send(sid, text="Earn Rs 5,000 daily, pay registration fee")
    assert chat.send(sid, text="ABC Holdings")["awaiting"] == "waiting"

    chat.loop.run_until_complete(asyncio.sleep(0.3))
    view = chat.session(sid)
    assert _status(view)["company"] == "failed"
    assert "The company check took too long." in view["messages"][-1]["text"]
    assert view["awaiting"] == "company"
    assert _chip_ids(view) == ["skip"]

    chat.company_gate = None
    chat.send(sid, text="ABC Holdings")
    chat.settle()
    assert chat.session(sid)["result"]["colour"] == "red"


def test_failed_company_check_is_asked_again_later(chat):
    chat.results["company"] = chat.CheckResult(
        source="company", status="failed", risk="unknown",
        reasons=["The company check is not available right now."],
    )
    sid = _start_at(chat, "check_company")
    chat.send(sid, text="ABC Holdings")
    chat.settle()

    view = chat.session(sid)
    assert "We can try it again after the other checks." in view["messages"][-1]["text"]
    assert view["awaiting"] == "job_post"

    body = chat.send(sid, text="Earn Rs 5,000 daily, pay registration fee")
    assert "Next, let's check the company." in body["reply"]
    assert body["awaiting"] == "company"


def test_new_check_stops_the_old_company_check(chat):
    chat.hold_company()
    sid = _start_at(chat, "check_company")
    chat.send(sid, text="ABC Holdings")

    new = chat.send(sid, chip="new_check")
    chat.release_company()

    assert new["session_id"] != sid
    old = chat.session(sid)
    assert old["running"] is False
    assert _status(old)["company"] == "skipped"
    assert not old["messages"][-1]["text"].startswith("Company check")
