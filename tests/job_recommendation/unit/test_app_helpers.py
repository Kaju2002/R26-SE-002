"""Unit tests for helper functions in app.py."""

from tests.service_imports import import_module

jr_app = import_module("job-recommendation", "app")


def test_find_missing_skills():
    user = ["python", "communication"]
    job_skills = "['python', 'django', 'sql']"
    missing = jr_app.find_missing_skills(user, job_skills)
    assert "django" in missing
    assert "sql" in missing
    assert "python" not in missing


def test_find_missing_skills_case_insensitive():
    user = ["Python"]
    job_skills = "['python', 'react']"
    missing = jr_app.find_missing_skills(user, job_skills)
    assert missing == ["react"]
