"""
Shared fixture for the assistant chat API tests: the app in-process with the three checks faked.
The LLM is off (guided mode) unless a test replaces `llm.get_client`.
"""

from __future__ import annotations

import asyncio
import time

import httpx
import jwt
import pytest

SECRET = "test-jwt-secret-that-is-at-least-32-bytes"


@pytest.fixture
def chat(monkeypatch):
    from tests.service_imports import import_module

    monkeypatch.setenv("JWT_SECRET", SECRET)
    monkeypatch.setenv("LLM_PROVIDER", "none")
    import_module("assistant", "app.config").get_settings.cache_clear()
    main = import_module("assistant", "app.main")
    main.store.clear()
    # One event loop for the whole test, so background checks keep running between requests.
    loop = asyncio.new_event_loop()
    yield Chat(main, monkeypatch, loop)
    main.store.clear()
    loop.run_until_complete(asyncio.sleep(0))
    loop.close()
    import_module("assistant", "app.config").get_settings.cache_clear()


class Chat:
    """Talks to the app in-process and fakes the three checks."""

    def __init__(self, main, monkeypatch, loop):
        self.main = main
        self.loop = loop
        self.guided = main.guided
        self.CheckResult = self.guided.CheckResult
        self.calls: list[tuple] = []
        # Set to an asyncio.Event to hold the company check until the test releases it.
        self.company_gate = None
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
            if self.company_gate is not None:
                await self.company_gate.wait()
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

    @staticmethod
    def token(user_id: str = "user-a") -> str:
        now = int(time.time())
        return jwt.encode({"userId": user_id, "iat": now, "exp": now + 600}, SECRET, algorithm="HS256")

    def done(self, source, risk, *reasons):
        return self.CheckResult(source=source, status="done", risk=risk, reasons=list(reasons))

    def request(self, method, path, token=None, **kwargs) -> httpx.Response:
        headers = {"Authorization": f"Bearer {token or self.token()}"}

        async def run():
            transport = httpx.ASGITransport(app=self.main.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                return await client.request(method, path, headers=headers, **kwargs)

        return self.loop.run_until_complete(run())

    def hold_company(self):
        self.company_gate = asyncio.Event()

    def release_company(self):
        self.company_gate.set()
        self.settle()

    def settle(self):
        """Let background checks run until they are finished or blocked."""
        for _ in range(5):
            self.loop.run_until_complete(asyncio.sleep(0.01))

    def session(self, session_id) -> dict:
        res = self.request("GET", f"/assistant/session/{session_id}")
        assert res.status_code == 200, res.text
        return res.json()

    def send(self, session_id=None, *, text=None, chip=None, image=None, token=None) -> dict:
        data = {k: v for k, v in {"session_id": session_id, "text": text, "chip": chip}.items() if v is not None}
        files = {"image": ("shot.png", image, "image/png")} if image is not None else None
        res = self.request("POST", "/assistant/message", token=token, data=data, files=files)
        assert res.status_code == 200, res.text
        return res.json()
