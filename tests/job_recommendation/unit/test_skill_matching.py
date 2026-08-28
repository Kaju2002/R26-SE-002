"""Unit tests for TF-IDF skill matching (mini fixture CSV, no full dataset)."""

from src.skill_matching import find_matched_skills, run_skill_matching


def test_find_matched_skills_partial_overlap():
    job_skills = "['python', 'django', 'communication']"
    matched = find_matched_skills(["Python", "SQL"], job_skills)
    assert "python" in matched


def test_find_matched_skills_no_overlap():
    job_skills = "['photoshop', 'illustrator']"
    matched = find_matched_skills(["python", "sql"], job_skills)
    assert matched == []


def test_run_skill_matching_ranks_hr_job_for_hr_profile(mini_jobs_path, samples: dict):
    skills = samples["user_skills"]["hr_profile"]
    results = run_skill_matching(str(mini_jobs_path), skills)

    assert len(results) == 4
    assert "skill_match_score" in results.columns
    assert "matched_skills" in results.columns

    top = results.sort_values("skill_match_score", ascending=False).iloc[0]
    assert top["job_title"] in ("HR Generalist", "Talent Acquisition Specialist")
    assert top["skill_match_score"] > 0


def test_run_skill_matching_tech_profile_prefers_python_job(mini_jobs_path, samples: dict):
    skills = samples["user_skills"]["tech_profile"]
    results = run_skill_matching(str(mini_jobs_path), skills)

    top = results.sort_values("skill_match_score", ascending=False).iloc[0]
    assert top["job_title"] == "Python Developer"
    assert top["matched_count"] >= 1
