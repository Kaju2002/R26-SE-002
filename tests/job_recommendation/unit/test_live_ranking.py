"""Unit tests for live job ranking (Mongo / job-management payloads)."""

from tests.service_imports import import_module

live_ranking = import_module("job-recommendation", "src.live_ranking")
rank_live_jobs = live_ranking.rank_live_jobs


def test_rank_live_jobs_returns_empty_without_skills(samples: dict):
    assert rank_live_jobs([], samples["live_jobs"]) == []


def test_rank_live_jobs_returns_empty_without_jobs(samples: dict):
    skills = samples["user_skills"]["hr_profile"]
    assert rank_live_jobs(skills, []) == []


def test_rank_live_jobs_orders_by_overall_fit(samples: dict):
    skills = samples["user_skills"]["hr_profile"]
    ranked = rank_live_jobs(skills, samples["live_jobs"], top_n=3)

    assert len(ranked) == 3
    assert ranked[0]["overall_fit"] >= ranked[1]["overall_fit"]
    assert ranked[0]["job_title"] == "HR Generalist"


def test_verified_job_gets_higher_trust(samples: dict):
    skills = samples["user_skills"]["tech_profile"]
    ranked = rank_live_jobs(skills, samples["live_jobs"], top_n=3)

    hr = next(item for item in ranked if item["job_id"] == "job-hr-1")
    tech = next(item for item in ranked if item["job_id"] == "job-tech-1")
    assert hr["trust_score"] > tech["trust_score"]


def test_response_shape(samples: dict):
    skills = samples["user_skills"]["hr_profile"]
    ranked = rank_live_jobs(skills, samples["live_jobs"][:1])

    item = ranked[0]
    for key in (
        "job_id",
        "job_title",
        "relevance",
        "trust_score",
        "overall_fit",
        "skills_you_have",
        "skills_to_develop",
    ):
        assert key in item


def test_fake_job_ranks_lower_than_legitimate_match():
    jobs = [
        {
            "id": "legit-1",
            "title": "Python Developer",
            "skills": ["python", "django"],
            "isVerified": True,
            "riskPrediction": "legitimate",
        },
        {
            "id": "fake-1",
            "title": "Python Developer",
            "skills": ["python", "django"],
            "isVerified": False,
            "riskPrediction": "fake",
        },
    ]
    ranked = rank_live_jobs(["python", "django"], jobs, top_n=2)

    assert ranked[0]["job_id"] == "legit-1"
    assert ranked[0]["trust_score"] > ranked[1]["trust_score"]
