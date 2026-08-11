import pandas as pd


# ===================================================
# File Paths
# ===================================================

TEST_USERS_FILE = (
    "evaluation/datasets/test_users.csv"
)

BASELINE_FILE = (
    "evaluation/baseline/results/"
    "baseline_recommendations.csv"
)

PROPOSED_FILE = (
    "evaluation/proposed/results/"
    "proposed_recommendations.csv"
)


# ===================================================
# Load Data
# ===================================================

test_users = pd.read_csv(TEST_USERS_FILE)
baseline = pd.read_csv(BASELINE_FILE)
proposed = pd.read_csv(PROPOSED_FILE)


# ===================================================
# Check Source Job Retrieval
# ===================================================

results = []


for _, user in test_users.iterrows():

    user_id = user["user_id"]
    source_job_id = user["source_job_id"]

    # -------------------------------
    # Baseline
    # -------------------------------

    baseline_user = baseline[
        baseline["user_id"] == user_id
    ]

    baseline_match = baseline_user[
        baseline_user["job_id"] == source_job_id
    ]

    if len(baseline_match) > 0:

        baseline_rank = int(
            baseline_match.iloc[0]["rank"]
        )

        baseline_hit = 1
        baseline_mrr = 1 / baseline_rank

    else:

        baseline_rank = None
        baseline_hit = 0
        baseline_mrr = 0


    # -------------------------------
    # Proposed
    # -------------------------------

    proposed_user = proposed[
        proposed["user_id"] == user_id
    ]

    proposed_match = proposed_user[
        proposed_user["job_id"] == source_job_id
    ]

    if len(proposed_match) > 0:

        proposed_rank = int(
            proposed_match.iloc[0]["rank"]
        )

        proposed_hit = 1
        proposed_mrr = 1 / proposed_rank

    else:

        proposed_rank = None
        proposed_hit = 0
        proposed_mrr = 0


    results.append({

        "user_id": user_id,

        "source_job_id": source_job_id,

        "baseline_hit@10": baseline_hit,

        "baseline_rank": baseline_rank,

        "baseline_rr@10": round(
            baseline_mrr,
            4
        ),

        "proposed_hit@10": proposed_hit,

        "proposed_rank": proposed_rank,

        "proposed_rr@10": round(
            proposed_mrr,
            4
        )
    })


results_df = pd.DataFrame(results)


# ===================================================
# Overall Metrics
# ===================================================

baseline_hit_rate = (
    results_df["baseline_hit@10"].mean()
)

proposed_hit_rate = (
    results_df["proposed_hit@10"].mean()
)

baseline_mrr = (
    results_df["baseline_rr@10"].mean()
)

proposed_mrr = (
    results_df["proposed_rr@10"].mean()
)


# ===================================================
# Print Results
# ===================================================

print("----------------------------------------")
print("Source Job Retrieval Check")
print("----------------------------------------")

print(
    f"Users Evaluated : "
    f"{len(results_df)}"
)

print("\n----------------------------------------")
print("Overall Results")
print("----------------------------------------")

print(
    f"Baseline Hit@10 : "
    f"{baseline_hit_rate:.4f}"
)

print(
    f"Proposed Hit@10 : "
    f"{proposed_hit_rate:.4f}"
)

print()

print(
    f"Baseline MRR@10 : "
    f"{baseline_mrr:.4f}"
)

print(
    f"Proposed MRR@10 : "
    f"{proposed_mrr:.4f}"
)


# ===================================================
# Detailed Results
# ===================================================

print("\n----------------------------------------")
print("Per-User Results")
print("----------------------------------------")

print(results_df.to_string(index=False))


# ===================================================
# Save Results
# ===================================================

OUTPUT_FILE = (
    "evaluation/evaluation_outputs/"
    "source_job_retrieval.csv"
)

results_df.to_csv(
    OUTPUT_FILE,
    index=False
)

print("\n----------------------------------------")
print("Check Complete!")
print("----------------------------------------")

print(
    f"Saved To: {OUTPUT_FILE}"
)