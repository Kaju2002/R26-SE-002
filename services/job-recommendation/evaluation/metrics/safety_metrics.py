import os
import sys
import pandas as pd


# ===================================================
# Fix Python Import Path
# ===================================================

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")
)

sys.path.insert(0, PROJECT_ROOT)


from src.risk_aggregation import run_risk_aggregation


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

RISK_FILE = "data/raw/risk_indicators.csv"

OUTPUT_PER_USER = (
    "evaluation/evaluation_outputs/"
    "safety_per_user.csv"
)

OUTPUT_OVERALL = (
    "evaluation/evaluation_outputs/"
    "safety_metrics.csv"
)


# ===================================================
# Configuration
# ===================================================

K = 10

# Temporary evaluation threshold
UNSAFE_THRESHOLD = 0.5


# ===================================================
# Load Recommendation Results
# ===================================================

baseline = pd.read_csv(
    BASELINE_FILE
)

proposed = pd.read_csv(
    PROPOSED_FILE
)


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
    f"Fake Job       : "
    f"{weights['fake_job_num']:.4f}"
)

print(
    f"Employer       : "
    f"{weights['employer_num']:.4f}"
)

print(
    f"Communication  : "
    f"{weights['comm_scam_num']:.4f}"
)


# ===================================================
# Prepare Risk Lookup
# ===================================================

risk_lookup = risk_results[
    [
        "job_id",
        "risk_score",
        "safety_score"
    ]
].copy()


# ===================================================
# Add Risk Information to Baseline
# ===================================================

baseline = baseline.merge(
    risk_lookup,
    on="job_id",
    how="left"
)


# Check missing risk values

missing_risk = (
    baseline["risk_score"].isna().sum()
)

if missing_risk > 0:

    raise ValueError(
        f"{missing_risk} baseline "
        f"recommendations have no risk score."
    )


# ===================================================
# Keep Top-K
# ===================================================

baseline = baseline[
    baseline["rank"] <= K
].copy()

proposed = proposed[
    proposed["rank"] <= K
].copy()


# ===================================================
# Calculate Per-User Metrics
# ===================================================

results = []


for user_id in sorted(
    baseline["user_id"].unique()
):

    baseline_user = baseline[
        baseline["user_id"] == user_id
    ]

    proposed_user = proposed[
        proposed["user_id"] == user_id
    ]


    # -----------------------------------------------
    # Average Risk@10
    # -----------------------------------------------

    baseline_risk = (
        baseline_user["risk_score"].mean()
    )

    proposed_risk = (
        proposed_user["risk_score"].mean()
    )


    # -----------------------------------------------
    # Average Safety@10
    # -----------------------------------------------

    baseline_safety = (
        baseline_user["safety_score"].mean()
    )

    proposed_safety = (
        proposed_user["safety_score"].mean()
    )


    # -----------------------------------------------
    # Unsafe Jobs
    # -----------------------------------------------

    baseline_unsafe = (
        baseline_user["risk_score"]
        >= UNSAFE_THRESHOLD
    ).sum()

    proposed_unsafe = (
        proposed_user["risk_score"]
        >= UNSAFE_THRESHOLD
    ).sum()


    # -----------------------------------------------
    # Unsafe Rate@10
    # -----------------------------------------------

    baseline_unsafe_rate = (
        baseline_unsafe / K
    )

    proposed_unsafe_rate = (
        proposed_unsafe / K
    )


    results.append({

        "user_id": user_id,

        "baseline_avg_risk":
            round(baseline_risk, 4),

        "proposed_avg_risk":
            round(proposed_risk, 4),

        "baseline_avg_safety":
            round(baseline_safety, 4),

        "proposed_avg_safety":
            round(proposed_safety, 4),

        "baseline_unsafe_rate":
            round(baseline_unsafe_rate, 4),

        "proposed_unsafe_rate":
            round(proposed_unsafe_rate, 4)
    })


# ===================================================
# Create Per-User DataFrame
# ===================================================

per_user = pd.DataFrame(
    results
)


# ===================================================
# Save Per-User Results
# ===================================================

per_user.to_csv(
    OUTPUT_PER_USER,
    index=False
)


# ===================================================
# Overall Metrics
# ===================================================

baseline_avg_risk = (
    per_user["baseline_avg_risk"].mean()
)

proposed_avg_risk = (
    per_user["proposed_avg_risk"].mean()
)

baseline_avg_safety = (
    per_user["baseline_avg_safety"].mean()
)

proposed_avg_safety = (
    per_user["proposed_avg_safety"].mean()
)

baseline_unsafe_rate = (
    per_user["baseline_unsafe_rate"].mean()
)

proposed_unsafe_rate = (
    per_user["proposed_unsafe_rate"].mean()
)


# ===================================================
# Percentage Changes
# ===================================================

if baseline_avg_risk != 0:

    risk_reduction = (
        (
            baseline_avg_risk
            - proposed_avg_risk
        )
        / baseline_avg_risk
        * 100
    )

else:

    risk_reduction = 0


if baseline_avg_safety != 0:

    safety_improvement = (
        (
            proposed_avg_safety
            - baseline_avg_safety
        )
        / baseline_avg_safety
        * 100
    )

else:

    safety_improvement = 0


if baseline_unsafe_rate != 0:

    unsafe_rate_reduction = (
        (
            baseline_unsafe_rate
            - proposed_unsafe_rate
        )
        / baseline_unsafe_rate
        * 100
    )

else:

    unsafe_rate_reduction = 0


# ===================================================
# Overall Results Table
# ===================================================

overall = pd.DataFrame({

    "Metric": [
        "Average Risk@10",
        "Average Safety@10",
        "Unsafe Rate@10"
    ],

    "Baseline": [
        baseline_avg_risk,
        baseline_avg_safety,
        baseline_unsafe_rate
    ],

    "Proposed": [
        proposed_avg_risk,
        proposed_avg_safety,
        proposed_unsafe_rate
    ],

    "Percentage Change": [
        -risk_reduction,
        safety_improvement,
        -unsafe_rate_reduction
    ]
})


# Round values

overall["Baseline"] = (
    overall["Baseline"].round(4)
)

overall["Proposed"] = (
    overall["Proposed"].round(4)
)

overall["Percentage Change"] = (
    overall["Percentage Change"].round(2)
)


# ===================================================
# Save Overall Results
# ===================================================

overall.to_csv(
    OUTPUT_OVERALL,
    index=False
)


# ===================================================
# Display Results
# ===================================================

print("\n----------------------------------------")
print("Safety Evaluation")
print("----------------------------------------")

print(
    f"Users Evaluated : "
    f"{len(per_user)}"
)

print(
    f"Top K           : {K}"
)

print(
    f"Unsafe Threshold: "
    f"{UNSAFE_THRESHOLD}"
)


print("\n----------------------------------------")
print("Overall Safety Results")
print("----------------------------------------")

print(
    overall.to_string(
        index=False
    )
)


print("\n----------------------------------------")
print("Safety Evaluation Complete!")
print("----------------------------------------")

print(
    f"Per-user results : "
    f"{OUTPUT_PER_USER}"
)

print(
    f"Overall metrics  : "
    f"{OUTPUT_OVERALL}"
)