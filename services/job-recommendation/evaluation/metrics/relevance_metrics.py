import pandas as pd
import numpy as np


# ===================================================
# File Paths
# ===================================================

GROUND_TRUTH_FILE = (
    "evaluation/datasets/ground_truth.csv"
)

BASELINE_FILE = (
    "evaluation/baseline/results/"
    "baseline_recommendations.csv"
)

PROPOSED_FILE = (
    "evaluation/proposed/results/"
    "proposed_recommendations.csv"
)

OUTPUT_PER_USER = (
    "evaluation/evaluation_outputs/"
    "relevance_per_user.csv"
)

OUTPUT_OVERALL = (
    "evaluation/evaluation_outputs/"
    "relevance_metrics.csv"
)

K = 10

# Relevance >= 2 is considered relevant
RELEVANT_THRESHOLD = 2


# ===================================================
# Load Data
# ===================================================

ground_truth = pd.read_csv(
    GROUND_TRUTH_FILE
)

baseline = pd.read_csv(
    BASELINE_FILE
)

proposed = pd.read_csv(
    PROPOSED_FILE
)


# ===================================================
# Prepare Ground Truth
# ===================================================

ground_truth["relevance"] = pd.to_numeric(
    ground_truth["relevance"]
)

relevance_lookup = {
    (row["user_id"], row["job_id"]):
    row["relevance"]

    for _, row in ground_truth.iterrows()
}


# ===================================================
# Metric Functions
# ===================================================

def precision_at_k(relevances, k=10):

    relevances = relevances[:k]

    relevant_count = sum(
        relevance >= RELEVANT_THRESHOLD
        for relevance in relevances
    )

    return relevant_count / k


def average_precision_at_k(
    relevances,
    k=10
):

    relevances = relevances[:k]

    relevant_seen = 0
    precision_sum = 0.0

    for rank, relevance in enumerate(
        relevances,
        start=1
    ):

        if relevance >= RELEVANT_THRESHOLD:

            relevant_seen += 1

            precision_sum += (
                relevant_seen / rank
            )

    total_relevant = sum(
        relevance >= RELEVANT_THRESHOLD
        for relevance in relevances
    )

    if total_relevant == 0:
        return 0.0

    return precision_sum / total_relevant


def reciprocal_rank_at_k(
    relevances,
    k=10
):

    relevances = relevances[:k]

    for rank, relevance in enumerate(
        relevances,
        start=1
    ):

        if relevance >= RELEVANT_THRESHOLD:
            return 1 / rank

    return 0.0


def ndcg_at_k(
    relevances,
    k=10
):

    relevances = relevances[:k]

    dcg = 0.0

    for rank, relevance in enumerate(
        relevances,
        start=1
    ):

        dcg += (
            (2 ** relevance - 1)
            / np.log2(rank + 1)
        )

    ideal_relevances = sorted(
        relevances,
        reverse=True
    )

    idcg = 0.0

    for rank, relevance in enumerate(
        ideal_relevances,
        start=1
    ):

        idcg += (
            (2 ** relevance - 1)
            / np.log2(rank + 1)
        )

    if idcg == 0:
        return 0.0

    return dcg / idcg


# ===================================================
# Evaluate System
# ===================================================

def evaluate_system(recommendations):

    results = []

    for user_id in sorted(
        recommendations["user_id"].unique()
    ):

        user_recommendations = (
            recommendations[
                recommendations["user_id"] == user_id
            ]
            .sort_values("rank")
            .head(K)
        )

        relevances = []

        for _, row in (
            user_recommendations.iterrows()
        ):

            key = (
                row["user_id"],
                row["job_id"]
            )

            relevance = relevance_lookup.get(
                key,
                0
            )

            relevances.append(
                relevance
            )

        results.append({

            "user_id": user_id,

            "Precision@10":
                precision_at_k(
                    relevances,
                    K
                ),

            "AP@10":
                average_precision_at_k(
                    relevances,
                    K
                ),

            "MRR@10":
                reciprocal_rank_at_k(
                    relevances,
                    K
                ),

            "NDCG@10":
                ndcg_at_k(
                    relevances,
                    K
                )
        })

    return pd.DataFrame(results)


# ===================================================
# Evaluate Baseline
# ===================================================

print("----------------------------------------")
print("Evaluating Baseline...")
print("----------------------------------------")

baseline_results = evaluate_system(
    baseline
)


# ===================================================
# Evaluate Proposed
# ===================================================

print("\n----------------------------------------")
print("Evaluating Proposed...")
print("----------------------------------------")

proposed_results = evaluate_system(
    proposed
)


# ===================================================
# Combine Per-User Results
# ===================================================

per_user = baseline_results.merge(
    proposed_results,
    on="user_id",
    suffixes=(
        "_Baseline",
        "_Proposed"
    )
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

metrics = [
    "Precision@10",
    "AP@10",
    "MRR@10",
    "NDCG@10"
]

overall = []

for metric in metrics:

    baseline_value = (
        baseline_results[metric].mean()
    )

    proposed_value = (
        proposed_results[metric].mean()
    )

    overall.append({

        "Metric": metric,

        "Baseline": round(
            baseline_value,
            4
        ),

        "Proposed": round(
            proposed_value,
            4
        ),

        "Difference": round(
            proposed_value - baseline_value,
            4
        )
    })


overall_df = pd.DataFrame(
    overall
)


# ===================================================
# Save Overall Results
# ===================================================

overall_df.to_csv(
    OUTPUT_OVERALL,
    index=False
)


# ===================================================
# Print Results
# ===================================================

print("\n----------------------------------------")
print("Overall Relevance Results")
print("----------------------------------------")

print(
    overall_df.to_string(
        index=False
    )
)

print("\n----------------------------------------")
print("Relevance Evaluation Complete!")
print("----------------------------------------")

print(
    f"Users Evaluated : "
    f"{len(baseline_results)}"
)

print(
    f"Top K           : {K}"
)

print(
    f"Relevant        : "
    f"Relevance >= {RELEVANT_THRESHOLD}"
)

print(
    f"\nPer-user results: "
    f"{OUTPUT_PER_USER}"
)

print(
    f"Overall metrics : "
    f"{OUTPUT_OVERALL}"
)