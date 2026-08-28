# app.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.skill_matching import run_skill_matching
from src.risk_aggregation import run_risk_aggregation
from src.ranking import run_ranking
from src.live_ranking import rank_live_jobs

import ast


# Initialize the API
app = FastAPI(title="Job Recommendation API")


# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserRequest(BaseModel):
    skills: list[str]


class LiveJobInput(BaseModel):
    id: str
    title: str
    skills: list[str] = Field(default_factory=list)
    isVerified: bool = False
    riskPrediction: str | None = None
    commIsScam: bool | None = None


class LiveRecommendRequest(BaseModel):
    skills: list[str]
    jobs: list[LiveJobInput]
    limit: int = 20


def find_missing_skills(user_skills, job_skills_string):
    """Find skills in the job that the user doesn't have."""

    user_lower = [s.lower() for s in user_skills]

    job_list = ast.literal_eval(job_skills_string)
    job_lower = [s.lower() for s in job_list]

    return [s for s in job_lower if s not in user_lower]


@app.get("/health")
def health():
    return {"ok": True, "service": "job-recommendation"}


@app.post("/recommend")
def recommend(request: UserRequest):
    """CSV + risk TOPSIS pipeline (dataset demo / evaluation)."""

    # Module 1: Skill Matching
    skill_results = run_skill_matching(
        'data/raw/jobs.csv',
        request.skills
    )

    # Module 2: Risk Aggregation
    risk_results, _ = run_risk_aggregation(
        'data/raw/risk_indicators.csv'
    )

    # Module 3: TOPSIS Ranking
    final_results = run_ranking(
        skill_results,
        risk_results
    )

    # Select top 10
    top_10 = final_results.head(10)

    # Build response
    response = []

    for _, row in top_10.iterrows():

        # Original job skill list
        job_skills_raw = skill_results.loc[
            skill_results['job_id'] == row['job_id'],
            'job_skill_set'
        ].values[0]

        matched = row.get('matched_skills', [])

        missing = find_missing_skills(
            request.skills,
            job_skills_raw
        )

        response.append({
            'job_id': int(row['job_id']),
            'job_title': row['job_title'],

            'relevance': round(
                float(row['skill_match_score']),
                4
            ),

            'trust_score': round(
                float(row['safety_score']),
                4
            ),

            'overall_fit': round(
                float(row['topsis_score']),
                4
            ),

            'skills_you_have':
                matched if isinstance(matched, list) else [],

            'skills_to_develop': missing,
        })

    return response


@app.post("/recommend/live")
def recommend_live(request: LiveRecommendRequest):
    """
    Rank live FraudAware jobs (Mongo / job-management) by profile skills.
    job_id is returned as a string so the mobile app can open Job Details.
    """
    skills = [s.strip() for s in request.skills if str(s).strip()]
    if not skills:
        raise HTTPException(status_code=400, detail="Add at least one skill.")

    if not request.jobs:
        return []

    payload = [
        {
            "id": job.id,
            "title": job.title,
            "skills": job.skills,
            "isVerified": job.isVerified,
            "riskPrediction": job.riskPrediction,
            "commIsScam": job.commIsScam,
        }
        for job in request.jobs
    ]

    return rank_live_jobs(skills, payload, top_n=request.limit)
