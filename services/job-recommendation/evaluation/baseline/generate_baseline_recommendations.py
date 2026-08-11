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


# ===================================================
# Configuration
# ===================================================

JOBS_FILE = "data/raw/jobs.csv"
TEST_USERS_FILE = "evaluation/datasets/test_users.csv"
OUTPUT_FILE = (
    "evaluation/baseline/results/baseline_recommendations.csv"
)

TOP_K = 10


# ===================================================
# Load datasets
# ===================================================

jobs_df = pd.read_csv(JOBS_FILE)
test_users = pd.read_csv(TEST_USERS_FILE)

all_recommendations = []

print("----------------------------------------")
print("Generating Baseline Recommendations...")
print("----------------------------------------")


# ===================================================
# Generate recommendations
# ===================================================

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

    # Run TF-IDF skill matching
    results = run_skill_matching(
        JOBS_FILE,
        user_skills
    )

    # Add job category
    results = results.merge(
        jobs_df[["job_id", "category"]],
        on="job_id",
        how="left"
    )

    # Sort only by skill match score
    results = results.sort_values(
        by="skill_match_score",
        ascending=False
    )

    # Keep Top-K
    top_jobs = results.head(TOP_K)

    # Store recommendations
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

            "matched_count": row["matched_count"],

            "matched_skills": ", ".join(
                row["matched_skills"]
            )
        })


# ===================================================
# Save recommendations
# ===================================================

recommendations_df = pd.DataFrame(
    all_recommendations
)

recommendations_df.to_csv(
    OUTPUT_FILE,
    index=False
)


print("\n----------------------------------------")
print("Baseline Recommendations Generated Successfully!")
print("----------------------------------------")
print(
    f"Users Processed : {len(test_users)}"
)
print(f"Top K           : {TOP_K}")
print(
    f"Total Records   : "
    f"{len(recommendations_df)}"
)
print(
    f"Saved To        : {OUTPUT_FILE}"
)