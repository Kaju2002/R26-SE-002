import pandas as pd


# ===================================================
# File Paths
# ===================================================

BASELINE_FILE = (
    "evaluation/baseline/results/"
    "baseline_recommendations.csv"
)

PROPOSED_FILE = (
    "evaluation/proposed/results/"
    "proposed_recommendations.csv"
)

JOBS_FILE = "data/raw/jobs.csv"

OUTPUT_FILE = (
    "evaluation/datasets/ground_truth.csv"
)


# ===================================================
# Load Data
# ===================================================

baseline = pd.read_csv(BASELINE_FILE)
proposed = pd.read_csv(PROPOSED_FILE)
jobs = pd.read_csv(JOBS_FILE)


# ===================================================
# Get Recommendation Candidates
# ===================================================

baseline_candidates = baseline[
    ["user_id", "job_id"]
].copy()

proposed_candidates = proposed[
    ["user_id", "job_id"]
].copy()


# Combine Baseline + Proposed
candidates = pd.concat(
    [
        baseline_candidates,
        proposed_candidates
    ],
    ignore_index=True
)


# Remove duplicate user-job pairs
candidates = candidates.drop_duplicates(
    subset=["user_id", "job_id"]
)


# ===================================================
# Add Job Information
# ===================================================

candidates = candidates.merge(
    jobs[
        [
            "job_id",
            "job_title",
            "category",
            "job_skill_set",
            "job_description"
        ]
    ],
    on="job_id",
    how="left"
)


# ===================================================
# Sort
# ===================================================

candidates = candidates.sort_values(
    by=["user_id", "job_id"]
).reset_index(drop=True)


# ===================================================
# Add Blank Relevance Columns
# ===================================================

candidates["relevance"] = ""
candidates["justification"] = ""


# ===================================================
# Select Final Columns
# ===================================================

ground_truth = candidates[
    [
        "user_id",
        "job_id",
        "job_title",
        "category",
        "job_skill_set",
        "job_description",
        "relevance",
        "justification"
    ]
]


# ===================================================
# Save
# ===================================================

ground_truth.to_csv(
    OUTPUT_FILE,
    index=False
)


# ===================================================
# Summary
# ===================================================

print("----------------------------------------")
print("Ground Truth Template Created")
print("----------------------------------------")

print(
    f"Users              : "
    f"{ground_truth['user_id'].nunique()}"
)

print(
    f"Candidate Records  : "
    f"{len(ground_truth)}"
)

print(
    f"Average Candidates : "
    f"{len(ground_truth) / ground_truth['user_id'].nunique():.2f}"
)

print(
    f"Saved To           : {OUTPUT_FILE}"
)