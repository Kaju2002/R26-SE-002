# app.py
from fastapi import FastAPI
from pydantic import BaseModel
from src.skill_matching import run_skill_matching
from src.risk_aggregation import run_risk_aggregation
from src.ranking import run_ranking

# Initialize the API
app = FastAPI(title="Job Recommendation API")

# Define what the app should send us
class UserRequest(BaseModel):
    skills: list[str]

# The main endpoint
@app.post("/recommend")
def recommend(request: UserRequest):
    """
    Takes user skills, runs all three modules,
    returns top 10 ranked jobs as JSON.
    """
    # Module 1
    skill_results = run_skill_matching('data/raw/jobs.csv', request.skills)
    
    # Module 2
    risk_results, _ = run_risk_aggregation('data/raw/risk_indicators.csv')
    
    # Module 3
    final_results = run_ranking(skill_results, risk_results)
    
    # Return top 10 as a list of dictionaries
    top_10 = final_results.head(10)
    return top_10[['job_id', 'job_title', 'skill_match_score', 
                   'safety_score', 'topsis_score']].to_dict(orient='records')