"""Profile and job-match tools. Detection services are not called."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest


@pytest.fixture
def profile_jobs():
    from tests.service_imports import import_module

    import_module("assistant", "app.config").get_settings.cache_clear()
    return import_module("assistant", "app.tools.profile_jobs")


def run(coro):
    return asyncio.run(coro)


class Router:
    def __init__(self, profile_skills, jobs=None, ranked=None):
        self.profile_skills = profile_skills
        self.jobs = jobs or []
        self.ranked = ranked or []
        self.puts: list = []
        self.paths: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.paths.append(request.url.path)
        if request.url.path.endswith("/api/profile/skills") and request.method == "PUT":
            self.puts.append(json.loads(request.content.decode()))
            return httpx.Response(200, json={"success": True})
        if request.url.path.endswith("/api/profile/me"):
            return httpx.Response(
                200,
                json={"success": True, "details": {"skills": self.profile_skills, "cvFiles": []}},
            )
        if request.url.path.endswith("/api/jobs"):
            return httpx.Response(200, json={"success": True, "jobs": self.jobs})
        if request.url.path.endswith("/recommend/live"):
            return httpx.Response(200, json=self.ranked)
        return httpx.Response(404, json={"success": False})

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler))


def _user():
    from app.auth import User

    return User(user_id="u1", token="token")


def _session():
    from app.sessions import Session

    return Session(session_id="s", user_id="u1")


def test_suggest_jobs_asks_for_skills_when_the_profile_is_empty(profile_jobs):
    router = Router([])
    result = run(profile_jobs.suggest_jobs(_user(), router.client()))
    assert result["needs_skills"] is True
    assert result["jobs"] == []
    assert "/recommend/live" not in "".join(router.paths)


def test_suggest_jobs_returns_ranked_titles(profile_jobs):
    router = Router(
        ["Python"],
        jobs=[
            {
                "id": "1",
                "title": "Backend Developer",
                "companyName": "Virtusa",
                "skills": ["Python", "SQL"],
                "isVerified": True,
            }
        ],
        ranked=[
            {
                "job_id": "1",
                "job_title": "Backend Developer",
                "skills_you_have": ["Python"],
                "skills_to_develop": ["SQL"],
            }
        ],
    )
    result = run(profile_jobs.suggest_jobs(_user(), router.client()))
    assert result["jobs"][0]["title"] == "Backend Developer"
    assert result["jobs"][0]["company"] == "Virtusa"
    assert result["jobs"][0]["skills_to_develop"] == ["SQL"]


def test_skill_is_not_saved_until_the_user_says_yes(profile_jobs):
    router = Router(["Java"])
    session = _session()
    proposed = profile_jobs.propose_add_skill(session, "Python")
    assert proposed["saved"] is False
    assert session.pending_skill == "Python"
    assert router.puts == []

    reply = run(profile_jobs.apply_confirmation(session, _user(), True, router.client()))
    assert "Added Python" in reply
    assert router.puts == [{"skills": ["Java", "Python"]}]
    assert session.pending_skill is None


def test_no_does_not_update_the_profile(profile_jobs):
    router = Router(["Java"])
    session = _session()
    profile_jobs.propose_add_skill(session, "Python")
    reply = run(profile_jobs.apply_confirmation(session, _user(), False, router.client()))
    assert "did not add" in reply
    assert router.puts == []
    assert session.pending_skill is None


def test_add_node_is_recognised_before_it_is_saved(profile_jobs):
    assert profile_jobs.skill_to_add("add Node.js to my skills") == "Node.js"
    assert profile_jobs.skill_to_add("add Node.js") == "Node.js"


def test_profile_questions_pass_the_scope_rules():
    from tests.service_imports import import_module

    rules = import_module("assistant", "app.scope_rules")
    guard = import_module("assistant", "app.guard")
    session = _session()
    assert rules.app_question("I want to know what are the jobs match to me") == "match"
    assert rules.app_question("Give the companies") == "companies"
    assert rules.app_question("what are the companies called IT works") == "companies"
    assert rules.app_question("show all jobs") == "posted_jobs"
    assert rules.app_question("What skills do I need for Backend Developer?") == "skills"
    assert rules.app_question("What is on my profile?") == "profile"
    assert rules.app_question("check this company Virtusa") is None
    assert guard.allowed_by_rules("Which job is suitable for me?", session)
    assert guard.allowed_by_rules("What skills do I need for Backend Developer?", session)
    assert guard.allowed_by_rules("What is on my profile?", session)
    assert guard.allowed_by_rules("Add Python to my skills", session)
    assert not guard.allowed_by_rules("What is the capital of France", session)


def test_skills_question_finds_the_job_and_its_company(profile_jobs):
    jobs = [
        {
            "id": "1",
            "title": "Junior Software Engineer",
            "companyName": "Optimize Solution Pvt Ltd",
            "skills": ["Java", "SQL"],
        },
        {
            "id": "2",
            "title": "Junior Software Engineer",
            "companyName": "Other Bank",
            "skills": ["Excel"],
        },
        {"id": "3", "title": "Software Engineer", "companyName": "Virtusa", "skills": ["Python"]},
    ]
    asked = "What are the skills needed for this junior software engineer at optimize solution pvt Ltd"
    match = profile_jobs.match_posted_job(jobs, asked)
    assert match["id"] == "1"

    again = "I want details Junior Software Engineer at Optimize Solution PVT LTD what are the skills I need to apply for this job"
    assert profile_jobs.match_posted_job(jobs, again)["id"] == "1"
    assert profile_jobs.match_posted_job(jobs, "this") is None

    router = Router(["Python"], jobs=jobs)
    reply = run(profile_jobs.reply_to_text(_session(), _user(), asked, router.client()))
    assert "Junior Software Engineer at Optimize Solution Pvt Ltd" in reply
    assert "Java" in reply
    assert "Other Bank" not in reply


def test_company_question_lists_posted_companies(profile_jobs):
    router = Router(
        ["Python"],
        jobs=[
            {"id": "1", "title": "Backend Developer", "companyName": "IT Works", "skills": ["Python"]},
            {"id": "2", "title": "Designer", "companyName": "Virtusa", "skills": ["Figma"]},
        ],
    )
    reply = run(profile_jobs.reply_to_text(_session(), _user(), "Give the companies", router.client()))
    assert "IT Works" in reply
    assert "Virtusa" in reply
    assert "/recommend/live" not in "".join(router.paths)

    named = run(
        profile_jobs.reply_to_text(
            _session(), _user(), "what are the companies called IT works", router.client()
        )
    )
    assert "Backend Developer at IT Works" in named
    assert "Virtusa" not in named


def test_match_question_includes_the_company(profile_jobs):
    router = Router(
        ["Python"],
        jobs=[
            {
                "id": "1",
                "title": "Backend Developer",
                "companyName": "Virtusa",
                "skills": ["Python", "SQL"],
                "isVerified": True,
            }
        ],
        ranked=[
            {
                "job_id": "1",
                "job_title": "Backend Developer",
                "skills_you_have": ["Python"],
                "skills_to_develop": ["SQL"],
            }
        ],
    )
    reply = run(
        profile_jobs.reply_to_text(
            _session(), _user(), "I want to know what are the jobs match to me", router.client()
        )
    )
    assert "Backend Developer at Virtusa" in reply
    assert "SQL" in reply
