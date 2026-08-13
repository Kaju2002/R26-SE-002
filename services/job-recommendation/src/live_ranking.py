"""Rank live job postings (e.g. from job-management) against user skills."""

from __future__ import annotations

from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


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
    Rank live jobs by TF-IDF skill similarity.

    Each job dict should include:
      - id (str)
      - title (str)
      - skills (list[str], optional)
      - is_verified / isVerified (bool, optional) — boosts trust_score
    """
    cleaned_skills = [str(s).strip() for s in user_skills if str(s).strip()]
    if not cleaned_skills:
        return []

    prepared: list[dict[str, Any]] = []
    for raw in jobs:
        job_id = str(raw.get("id") or raw.get("job_id") or "").strip()
        title = str(raw.get("title") or raw.get("job_title") or "").strip()
        if not job_id or not title:
            continue

        job_skills = _normalize_skill_list(raw.get("skills") or raw.get("job_skills"))
        # Fall back to title words so jobs without skills still rank a little
        skill_text = " ".join(job_skills).lower() if job_skills else title.lower()
        verified = bool(raw.get("is_verified") if "is_verified" in raw else raw.get("isVerified"))

        prepared.append(
            {
                "job_id": job_id,
                "job_title": title,
                "job_skills": job_skills,
                "skill_text": skill_text,
                "is_verified": verified,
            }
        )

    if not prepared:
        return []

    user_text = " ".join(cleaned_skills).lower()
    corpus = [user_text] + [row["skill_text"] for row in prepared]

    vectorizer = TfidfVectorizer(lowercase=True, stop_words="english")
    try:
        matrix = vectorizer.fit_transform(corpus)
    except ValueError:
        # Empty vocabulary (very short skills) — fall back to matched-count ranking
        for row in prepared:
            matched = _find_matched_skills(cleaned_skills, row["job_skills"])
            row["skill_match_score"] = (
                len(matched) / max(len(cleaned_skills), 1)
            )
        similarities = None
    else:
        similarities = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

    results: list[dict[str, Any]] = []
    for index, row in enumerate(prepared):
        if similarities is not None:
            skill_score = float(similarities[index])
        else:
            skill_score = float(row["skill_match_score"])

        matched = _find_matched_skills(cleaned_skills, row["job_skills"])
        missing = _find_missing_skills(cleaned_skills, row["job_skills"])

        # Verified employers get a higher trust baseline
        trust = 0.85 if row["is_verified"] else 0.55
        # Blend skill + trust for overall fit (same spirit as TOPSIS weights)
        overall = float(0.65 * skill_score + 0.35 * trust)

        results.append(
            {
                "job_id": row["job_id"],
                "job_title": row["job_title"],
                "relevance": round(skill_score, 4),
                "trust_score": round(trust, 4),
                "overall_fit": round(overall, 4),
                "skills_you_have": matched,
                "skills_to_develop": missing[:12],
            }
        )

    results.sort(key=lambda item: item["overall_fit"], reverse=True)
    return results[: max(1, top_n)]
