"""Unit tests for TOPSIS ranking."""

import pandas as pd

from src.ranking import run_ranking


def _sample_frames():
    skill_df = pd.DataFrame(
        {
            "job_id": [1, 2],
            "job_title": ["Safe HR", "Risky Dev"],
            "skill_match_score": [0.9, 0.9],
            "matched_skills": [["python"], ["python"]],
            "matched_count": [1, 1],
            "job_skill_set": ["['python']", "['python']"],
        }
    )
    risk_df = pd.DataFrame(
        {
            "job_id": [1, 2],
            "risk_score": [0.1, 0.9],
            "safety_score": [0.9, 0.1],
        }
    )
    return skill_df, risk_df


def test_run_ranking_returns_topsis_score():
    skill_df, risk_df = _sample_frames()
    ranked = run_ranking(skill_df, risk_df)

    assert "topsis_score" in ranked.columns
    assert len(ranked) == 2
    assert ranked.iloc[0]["topsis_score"] >= ranked.iloc[1]["topsis_score"]


def test_safer_job_ranks_first_when_skills_equal():
    skill_df, risk_df = _sample_frames()
    ranked = run_ranking(skill_df, risk_df)

    assert ranked.iloc[0]["job_id"] == 1
    assert ranked.iloc[0]["safety_score"] > ranked.iloc[1]["safety_score"]
