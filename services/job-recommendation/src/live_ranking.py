"""Rank live job postings (e.g. from job-management) against user skills."""

from __future__ import annotations

from typing import Any

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from src.indicator_mapper import job_to_indicator_row
from src.ranking import run_ranking
from src.risk_aggregation import run_risk_aggregation_from_rows


def _normalize_skill_list(skills: Any) -> list[str]:
    if skills is None:
        return []
    if isinstance(skills, str):
        text = skills.strip()
        return [text] if text else []
    if isinstance(skills, list):
        return [str(s).strip() for s in skills if str(s).strip()]
    return []


def _find_matched_skills(user_skills: list[str], job_skills: list[str]) -> list[str]:
    user_lower = [s.lower() for s in user_skills]
    job_lower = [s.lower() for s in job_skills]
    matched: list[str] = []

    for user_skill in user_lower:
        for job_skill in job_lower:
            if user_skill in job_skill or job_skill in user_skill:
                matched.append(user_skill)
                break

    return matched


def _find_missing_skills(user_skills: list[str], job_skills: list[str]) -> list[str]:
    user_lower = [s.lower() for s in user_skills]
    missing: list[str] = []
    for skill in job_skills:
        lower = skill.lower()
        if any(u in lower or lower in u for u in user_lower):
            continue
        missing.append(skill)
    return missing


def rank_live_jobs(
    user_skills: list[str],
    jobs: list[dict[str, Any]],
    *,
    top_n: int = 20,
) -> list[dict[str, Any]]:
    """
    Rank live jobs by TF-IDF skill similarity + EWM risk + TOPSIS.

    Each job dict should include:
      - id (str)
      - title (str)
      - skills (list[str], optional)
      - is_verified / isVerified (bool, optional)
      - risk_prediction / riskPrediction / riskCheck.prediction (optional)
      - comm_is_scam / commIsScam (optional)
    """
    cleaned_skills = [str(s).strip() for s in user_skills if str(s).strip()]
    if not cleaned_skills:
        return []

    raw_by_id: dict[str, dict[str, Any]] = {}
    prepared: list[dict[str, Any]] = []
    for raw in jobs:
        job_id = str(raw.get("id") or raw.get("job_id") or "").strip()
        title = str(raw.get("title") or raw.get("job_title") or "").strip()
        if not job_id or not title:
            continue

        raw_by_id[job_id] = raw
        job_skills = _normalize_skill_list(raw.get("skills") or raw.get("job_skills"))
        skill_text = " ".join(job_skills).lower() if job_skills else title.lower()

        prepared.append(
            {
                "job_id": job_id,
                "job_title": title,
                "job_skills": job_skills,
                "skill_text": skill_text,
            }
        )

    if not prepared:
        return []

    user_text = " ".join(cleaned_skills).lower()
    corpus = [user_text] + [row["skill_text"] for row in prepared]

    vectorizer = TfidfVectorizer(lowercase=True, stop_words="english")
    try:
        matrix = vectorizer.fit_transform(corpus)
        similarities = cosine_similarity(matrix[0:1], matrix[1:]).flatten()
    except ValueError:
        similarities = None
        for row in prepared:
            matched = _find_matched_skills(cleaned_skills, row["job_skills"])
            row["skill_match_score"] = len(matched) / max(len(cleaned_skills), 1)

    skill_rows: list[dict[str, Any]] = []
    extras_by_id: dict[str, dict[str, Any]] = {}

    for index, row in enumerate(prepared):
        if similarities is not None:
            skill_score = float(similarities[index])
        else:
            skill_score = float(row["skill_match_score"])

        matched = _find_matched_skills(cleaned_skills, row["job_skills"])
        missing = _find_missing_skills(cleaned_skills, row["job_skills"])

        skill_rows.append(
            {
                "job_id": row["job_id"],
                "job_title": row["job_title"],
                "skill_match_score": skill_score,
                "matched_skills": matched,
                "matched_count": len(matched),
                "job_skill_set": str(row["job_skills"]),
            }
        )
        extras_by_id[row["job_id"]] = {
            "skills_you_have": matched,
            "skills_to_develop": missing[:12],
        }

    skill_df = pd.DataFrame(skill_rows)
    indicator_rows = [job_to_indicator_row(raw_by_id[row["job_id"]]) for row in prepared]
    risk_df, _ = run_risk_aggregation_from_rows(indicator_rows)
    final_df = run_ranking(skill_df, risk_df)

    results: list[dict[str, Any]] = []
    for _, row in final_df.iterrows():
        job_id = str(row["job_id"])
        extras = extras_by_id.get(job_id, {})

        results.append(
            {
                "job_id": job_id,
                "job_title": row["job_title"],
                "relevance": round(float(row["skill_match_score"]), 4),
                "trust_score": round(float(row["safety_score"]), 4),
                "overall_fit": round(float(row["topsis_score"]), 4),
                "skills_you_have": extras.get("skills_you_have", []),
                "skills_to_develop": extras.get("skills_to_develop", []),
            }
        )

    return results[: max(1, top_n)]
