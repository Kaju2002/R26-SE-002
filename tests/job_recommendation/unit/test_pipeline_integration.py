"""
Optional integration — full skill + risk + TOPSIS pipeline on service CSVs.
Skipped when data/raw files are not on disk.
"""

from __future__ import annotations

import pytest

from src.ranking import run_ranking
from src.risk_aggregation import run_risk_aggregation
from src.skill_matching import run_skill_matching


def test_full_pipeline_on_service_data(full_dataset_ready: bool, samples: dict):
    if not full_dataset_ready:
        pytest.skip("job-recommendation CSV datasets not available")

    from pathlib import Path

    service_root = Path(__file__).resolve().parents[3] / "services" / "job-recommendation"
    jobs_path = service_root / "data" / "raw" / "jobs.csv"
    risk_path = service_root / "data" / "raw" / "risk_indicators.csv"

    skills = samples["user_skills"]["hr_profile"]
    skill_results = run_skill_matching(str(jobs_path), skills)
    risk_results, _ = run_risk_aggregation(str(risk_path))
    final = run_ranking(skill_results, risk_results)

    assert len(final) > 10
    assert final.iloc[0]["topsis_score"] >= final.iloc[9]["topsis_score"]
