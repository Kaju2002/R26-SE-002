import os
import sys
import pandas as pd

# ===================================================
# Fix Python import path
# ===================================================

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")
)

sys.path.insert(0, PROJECT_ROOT)

from src.skill_matching import run_skill_matching
from src.risk_aggregation import run_risk_aggregation
from src.ranking import run_ranking


# ===================================================
# Configuration
# ===================================================

JOBS_FILE = "data/raw/jobs.csv"
RISK_FILE = "data/raw/risk_indicators.csv"
TEST_USERS_FILE = "evaluation/datasets/test_users.csv"

OUTPUT_FILE = (
    "evaluation/proposed/results/proposed_recommendations.csv"
)

TOP_K = 10


# ===================================================
# Load datasets
# ===================================================

jobs_df = pd.read_csv(JOBS_FILE)
test_users = pd.read_csv(TEST_USERS_FILE)


# ===================================================
# Calculate Risk Scores
# ===================================================

print("----------------------------------------")
print("Calculating Risk Scores...")
print("----------------------------------------")

risk_results, weights = run_risk_aggregation(
    RISK_FILE
)

print("\nEWM Weights:")
print(
    f"Fake Job       : {weights['fake_job_num']:.4f}"
)
print(
    f"Employer       : {weights['employer_num']:.4f}"
)
print(
    f"Communication  : {weights['comm_scam_num']:.4f}"
)


# ===================================================
# Generate Proposed Recommendations
# ===================================================

all_recommendations = []

print("\n----------------------------------------")
print("Generating Proposed Recommendations...")
print("----------------------------------------")


for _, user in test_users.iterrows():

    user_id = user["user_id"]
    user_domain = user["domain"]

    # Convert skills string into list
    user_skills = [
        skill.strip()
        for skill in user["skills"].split(",")
    ]

    print(
        f"Processing User {user_id} "
        f"({user_domain})"
    )

    # =================================================
    # Module 1: Skill Matching
    # =================================================

    skill_results = run_skill_matching(
        JOBS_FILE,
        user_skills
    )

    # =================================================
    # Module 2 + 3: Risk-aware Ranking
    # =================================================

    final_results = run_ranking(
        skill_results,
        risk_results
    )

    # =================================================
    # Add Job Category
    # =================================================

    final_results = final_results.merge(
        jobs_df[["job_id", "category"]],
        on="job_id",
        how="left"
    )

    # =================================================
    # Select Top K
    # =================================================

    top_jobs = final_results.head(TOP_K)

    # =================================================
    # Store Recommendations
    # =================================================

    for rank, (_, row) in enumerate(
        top_jobs.iterrows(),
        start=1
    ):

        all_recommendations.append({

            "user_id": user_id,

            "user_domain": user_domain,

            "rank": rank,

            "job_id": row["job_id"],

            "job_title": row["job_title"],

            "job_category": row["category"],

            "skill_match_score": round(
                float(row["skill_match_score"]),
                4
            ),

            "risk_score": round(
                float(row["risk_score"]),
                4
            ),

            "safety_score": round(
                float(row["safety_score"]),
                4
            ),

            "topsis_score": round(
                float(row["topsis_score"]),
                4
            ),

            "matched_count": row["matched_count"],

            "matched_skills": ", ".join(
                row["matched_skills"]
            )

        })


# ===================================================
# Save Recommendations
# ===================================================

recommendations_df = pd.DataFrame(
    all_recommendations
)

recommendations_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ===================================================
# Final Summary
# ===================================================

print("\n----------------------------------------")
print(
    "Proposed Recommendations Generated "
    "Successfully!"
)
print("----------------------------------------")

print(
    f"Users Processed : {len(test_users)}"
)

print(
    f"Top K           : {TOP_K}"
)

print(
    f"Total Records   : "
    f"{len(recommendations_df)}"
)

print(
    f"Saved To        : {OUTPUT_FILE}"
)