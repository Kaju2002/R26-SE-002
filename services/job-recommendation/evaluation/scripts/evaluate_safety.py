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

OUTPUT_FILE = (
    "evaluation/evaluation_outputs/"
    "safety_comparison.csv"
)

K = 10

# Temporary threshold
UNSAFE_THRESHOLD = 0.5


# ===================================================
# Load Recommendation Results
# ===================================================

baseline = pd.read_csv(BASELINE_FILE)
proposed = pd.read_csv(PROPOSED_FILE)


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
# Prepare Risk Data
# ===================================================

risk_lookup = risk_results[
    [
        "job_id",
        "risk_score",
        "safety_score"
    ]
].copy()


# ===================================================
# Add Risk to Baseline
# ===================================================

baseline = baseline.merge(
    risk_lookup,
    on="job_id",
    how="left"
)


# Check for missing risk values
missing_baseline_risk = (
    baseline["risk_score"].isna().sum()
)

if missing_baseline_risk > 0:

    raise ValueError(
        f"{missing_baseline_risk} baseline "
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
# Calculate Per-User Safety Metrics
# ===================================================

results = []

user_ids = sorted(
    baseline["user_id"].unique()
)


for user_id in user_ids:

    baseline_user = baseline[
        baseline["user_id"] == user_id
    ]

    proposed_user = proposed[
        proposed["user_id"] == user_id
    ]

    # -----------------------------------------------
    # Average Risk@10
    # -----------------------------------------------

    baseline_avg_risk = (
        baseline_user["risk_score"].mean()
    )

    proposed_avg_risk = (
        proposed_user["risk_score"].mean()
    )

    # -----------------------------------------------
    # Average Safety@10
    # -----------------------------------------------

    baseline_avg_safety = (
        baseline_user["safety_score"].mean()
    )

    proposed_avg_safety = (
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

        "baseline_avg_risk": round(
            baseline_avg_risk,
            4
        ),

        "proposed_avg_risk": round(
            proposed_avg_risk,
            4
        ),

        "baseline_avg_safety": round(
            baseline_avg_safety,
            4
        ),

        "proposed_avg_safety": round(
            proposed_avg_safety,
            4
        ),

        "baseline_unsafe_rate": round(
            baseline_unsafe_rate,
            4
        ),

        "proposed_unsafe_rate": round(
            proposed_unsafe_rate,
            4
        )
    })


results_df = pd.DataFrame(results)


# ===================================================
# Save Per-User Results
# ===================================================

results_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ===================================================
# Overall Results
# ===================================================

baseline_risk = (
    results_df["baseline_avg_risk"].mean()
)

proposed_risk = (
    results_df["proposed_avg_risk"].mean()
)

baseline_safety = (
    results_df["baseline_avg_safety"].mean()
)

proposed_safety = (
    results_df["proposed_avg_safety"].mean()
)

baseline_unsafe = (
    results_df["baseline_unsafe_rate"].mean()
)

proposed_unsafe = (
    results_df["proposed_unsafe_rate"].mean()
)


# ===================================================
# Percentage Changes
# ===================================================

if baseline_risk != 0:

    risk_reduction = (
        (baseline_risk - proposed_risk)
        / baseline_risk
        * 100
    )

else:
    risk_reduction = 0


if baseline_safety != 0:

    safety_improvement = (
        (proposed_safety - baseline_safety)
        / baseline_safety
        * 100
    )

else:
    safety_improvement = 0


if baseline_unsafe != 0:

    unsafe_reduction = (
        (baseline_unsafe - proposed_unsafe)
        / baseline_unsafe
        * 100
    )

else:
    unsafe_reduction = 0


# ===================================================
# Print Results
# ===================================================

print("\n----------------------------------------")
print("Safety Evaluation")
print("----------------------------------------")

print(
    f"Users Evaluated : {len(results_df)}"
)

print(
    f"Top K           : {K}"
)

print(
    f"Unsafe Threshold: {UNSAFE_THRESHOLD}"
)


print("\n----------------------------------------")
print("Overall Safety Results")
print("----------------------------------------")

print(
    f"Baseline Average Risk@10 : "
    f"{baseline_risk:.4f}"
)

print(
    f"Proposed Average Risk@10 : "
    f"{proposed_risk:.4f}"
)

print(
    f"Risk Reduction           : "
    f"{risk_reduction:.2f}%"
)

print()

print(
    f"Baseline Average Safety@10 : "
    f"{baseline_safety:.4f}"
)

print(
    f"Proposed Average Safety@10 : "
    f"{proposed_safety:.4f}"
)

print(
    f"Safety Improvement          : "
    f"{safety_improvement:.2f}%"
)

print()

print(
    f"Baseline Unsafe Rate@10 : "
    f"{baseline_unsafe:.4f}"
)

print(
    f"Proposed Unsafe Rate@10 : "
    f"{proposed_unsafe:.4f}"
)

print(
    f"Unsafe Rate Reduction   : "
    f"{unsafe_reduction:.2f}%"
)


print("\n----------------------------------------")
print("Safety Evaluation Complete!")
print("----------------------------------------")

print(
    f"Results saved to: {OUTPUT_FILE}"
)