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

OUTPUT_FILE = (
    "evaluation/evaluation_outputs/"
    "baseline_vs_proposed_recommendations.csv"
)


# ===================================================
# Load Recommendations
# ===================================================

baseline = pd.read_csv(BASELINE_FILE)
proposed = pd.read_csv(PROPOSED_FILE)


# ===================================================
# Compare Per User
# ===================================================

comparison_results = []


for user_id in baseline["user_id"].unique():

    baseline_user = baseline[
        baseline["user_id"] == user_id
    ]

    proposed_user = proposed[
        proposed["user_id"] == user_id
    ]

    baseline_jobs = set(
        baseline_user["job_id"]
    )

    proposed_jobs = set(
        proposed_user["job_id"]
    )

    common_jobs = (
        baseline_jobs.intersection(
            proposed_jobs
        )
    )

    baseline_only = (
        baseline_jobs - proposed_jobs
    )

    proposed_only = (
        proposed_jobs - baseline_jobs
    )

    comparison_results.append({

        "user_id": user_id,

        "baseline_top10": len(
            baseline_jobs
        ),

        "proposed_top10": len(
            proposed_jobs
        ),

        "common_jobs": len(
            common_jobs
        ),

        "baseline_only": len(
            baseline_only
        ),

        "proposed_only": len(
            proposed_only
        ),

        "overlap_percentage": round(
            len(common_jobs) / 10 * 100,
            2
        )
    })


# ===================================================
# Save Per-User Comparison
# ===================================================

comparison_df = pd.DataFrame(
    comparison_results
)

comparison_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ===================================================
# Overall Summary
# ===================================================

print("----------------------------------------")
print("Baseline vs Proposed Comparison")
print("----------------------------------------")

print(
    f"Users Compared : "
    f"{len(comparison_df)}"
)

print(
    f"Average Common Jobs : "
    f"{comparison_df['common_jobs'].mean():.2f}"
)

print(
    f"Average Overlap     : "
    f"{comparison_df['overlap_percentage'].mean():.2f}%"
)

print(
    f"Average Baseline-Only Jobs : "
    f"{comparison_df['baseline_only'].mean():.2f}"
)

print(
    f"Average Proposed-Only Jobs : "
    f"{comparison_df['proposed_only'].mean():.2f}"
)

print("\nFirst 10 Users:")
print(comparison_df.head(10))

print("\n----------------------------------------")
print("Comparison Complete!")
print("----------------------------------------")

print(
    f"Saved To: {OUTPUT_FILE}"
)