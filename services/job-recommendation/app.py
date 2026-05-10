# app.py
from fastapi import FastAPI
from pydantic import BaseModel
from src.skill_matching import run_skill_matching
from src.risk_aggregation import run_risk_aggregation
from src.ranking import run_ranking
import ast


# Initialize the API
app = FastAPI(title="Job Recommendation API")


class UserRequest(BaseModel):
    skills: list[str]


def find_missing_skills(user_skills, job_skills_string):
    """Find skills in the job that the user doesn't have."""
    user_lower = [s.lower() for s in user_skills]
    job_list = ast.literal_eval(job_skills_string)
    job_lower = [s.lower() for s in job_list]
    return [s for s in job_lower if s not in user_lower]


@app.post("/recommend")
def recommend(request: UserRequest):
    # Module 1: Skill Matching
    skill_results = run_skill_matching('data/raw/jobs.csv', request.skills)

    # Module 2: Risk Aggregation
    risk_results, _ = run_risk_aggregation('data/raw/risk_indicators.csv')

    # Module 3: TOPSIS Ranking
    final_results = run_ranking(skill_results, risk_results)

    # Select top 10
    top_10 = final_results.head(10)

    # Build enriched response with user-friendly names
    response = []
    for _, row in top_10.iterrows():
        # Get original job data for skill gap analysis
        job_skills_raw = skill_results.loc[
            skill_results['job_id'] == row['job_id'], 'job_skill_set'
        ].values[0]

        matched = row.get('matched_skills', [])
        missing = find_missing_skills(request.skills, job_skills_raw)

        response.append({
            'job_id': int(row['job_id']),
            'job_title': row['job_title'],
            'relevance': round(float(row['skill_match_score']), 4),
            'trust_score': round(float(row['safety_score']), 4),
            'overall_fit': round(float(row['topsis_score']), 4),
            'skills_you_have': matched if isinstance(matched, list) else [],
            'skills_to_develop': missing,
        })

    return response