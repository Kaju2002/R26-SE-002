import pandas as pd
import numpy as np
from scipy.stats import wilcoxon


# ===================================================
# File Paths
# ===================================================

RELEVANCE_FILE = (
    "evaluation/evaluation_outputs/"
    "relevance_per_user.csv"
)

SAFETY_FILE = (
    "evaluation/evaluation_outputs/"
    "safety_per_user.csv"
)

OUTPUT_FILE = (
    "evaluation/evaluation_outputs/"
    "statistical_results.csv"
)


# ===================================================
# Configuration
# ===================================================

ALPHA = 0.05


# ===================================================
# Load Per-User Results
# ===================================================

relevance = pd.read_csv(
    RELEVANCE_FILE
)

safety = pd.read_csv(
    SAFETY_FILE
)


# ===================================================
# Metrics to Test
# ===================================================

metrics = [

    # Relevance
    {
        "name": "Precision@10",
        "baseline": "Precision@10_Baseline",
        "proposed": "Precision@10_Proposed",
        "evaluation": "Relevance"
    },

    {
        "name": "AP@10",
        "baseline": "AP@10_Baseline",
        "proposed": "AP@10_Proposed",
        "evaluation": "Relevance"
    },

    {
        "name": "MRR@10",
        "baseline": "MRR@10_Baseline",
        "proposed": "MRR@10_Proposed",
        "evaluation": "Relevance"
    },

    {
        "name": "NDCG@10",
        "baseline": "NDCG@10_Baseline",
        "proposed": "NDCG@10_Proposed",
        "evaluation": "Relevance"
    },

    # Safety
    {
        "name": "Average Risk@10",
        "baseline": "baseline_avg_risk",
        "proposed": "proposed_avg_risk",
        "evaluation": "Safety"
    },

    {
        "name": "Average Safety@10",
        "baseline": "baseline_avg_safety",
        "proposed": "proposed_avg_safety",
        "evaluation": "Safety"
    },

    {
        "name": "Unsafe Rate@10",
        "baseline": "baseline_unsafe_rate",
        "proposed": "proposed_unsafe_rate",
        "evaluation": "Safety"
    }
]


# ===================================================
# Rank-Biserial Effect Size
# ===================================================

def rank_biserial_effect(
    differences
):

    differences = np.asarray(
        differences
    )

    differences = differences[
        differences != 0
    ]

    if len(differences) == 0:
        return 0.0

    absolute_values = np.abs(
        differences
    )

    ranks = pd.Series(
        absolute_values
    ).rank(
        method="average"
    ).to_numpy()

    positive_rank_sum = ranks[
        differences > 0
    ].sum()

    negative_rank_sum = ranks[
        differences < 0
    ].sum()

    total_rank_sum = (
        positive_rank_sum
        + negative_rank_sum
    )

    if total_rank_sum == 0:
        return 0.0

    return (
        positive_rank_sum
        - negative_rank_sum
    ) / total_rank_sum


# ===================================================
# Interpret Effect Size
# ===================================================

def interpret_effect(
    effect
):

    absolute_effect = abs(effect)

    if absolute_effect < 0.10:
        return "Negligible"

    elif absolute_effect < 0.30:
        return "Small"

    elif absolute_effect < 0.50:
        return "Moderate"

    else:
        return "Large"


# ===================================================
# Statistical Analysis
# ===================================================

results = []


for metric in metrics:

    baseline = (
        relevance[metric["baseline"]]
        if metric["evaluation"] == "Relevance"
        else safety[metric["baseline"]]
    )

    proposed = (
        relevance[metric["proposed"]]
        if metric["evaluation"] == "Relevance"
        else safety[metric["proposed"]]
    )


    # Convert to numeric
    baseline = pd.to_numeric(
        baseline,
        errors="coerce"
    )

    proposed = pd.to_numeric(
        proposed,
        errors="coerce"
    )


    # Remove missing pairs
    valid = (
        baseline.notna()
        & proposed.notna()
    )

    baseline = baseline[valid]
    proposed = proposed[valid]


    # Proposed - Baseline
    differences = (
        proposed.to_numpy()
        - baseline.to_numpy()
    )


    # -----------------------------------------------
    # Descriptive Statistics
    # -----------------------------------------------

    mean_difference = (
        np.mean(differences)
    )

    median_difference = (
        np.median(differences)
    )


    # -----------------------------------------------
    # Wilcoxon Signed-Rank Test
    # -----------------------------------------------

    non_zero = differences[
        differences != 0
    ]


    if len(non_zero) == 0:

        statistic = 0.0
        p_value = 1.0

    else:

        test = wilcoxon(
            baseline,
            proposed,
            alternative="two-sided",
            zero_method="wilcox"
        )

        statistic = float(
            test.statistic
        )

        p_value = float(
            test.pvalue
        )


    # -----------------------------------------------
    # Effect Size
    # -----------------------------------------------

    effect_size = rank_biserial_effect(
        differences
    )

    effect_interpretation = (
        interpret_effect(
            effect_size
        )
    )


    # -----------------------------------------------
    # Significance
    # -----------------------------------------------

    significant = (
        p_value < ALPHA
    )


    # -----------------------------------------------
    # Store Result
    # -----------------------------------------------

    results.append({

        "Evaluation":
            metric["evaluation"],

        "Metric":
            metric["name"],

        "N":
            len(differences),

        "Baseline Mean":
            round(
                baseline.mean(),
                4
            ),

        "Proposed Mean":
            round(
                proposed.mean(),
                4
            ),

        "Mean Difference":
            round(
                mean_difference,
                4
            ),

        "Median Difference":
            round(
                median_difference,
                4
            ),

        "Wilcoxon Statistic":
            round(
                statistic,
                4
            ),

        "p-value":
            round(
                p_value,
                6
            ),

        "Effect Size":
            round(
                effect_size,
                4
            ),

        "Effect Interpretation":
            effect_interpretation,

        "Significant (α=0.05)":
            "Yes"
            if significant
            else "No"
    })


# ===================================================
# Create Results DataFrame
# ===================================================

results_df = pd.DataFrame(
    results
)


# ===================================================
# Save Results
# ===================================================

results_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ===================================================
# Display Results
# ===================================================

print("----------------------------------------")
print("Statistical Analysis")
print("----------------------------------------")

print(
    "Paired Wilcoxon Signed-Rank Test"
)

print(
    f"Significance Level (α): "
    f"{ALPHA}"
)

print()

print(
    results_df.to_string(
        index=False
    )
)


print("\n----------------------------------------")
print("Statistical Analysis Complete!")
print("----------------------------------------")

print(
    f"Saved To: {OUTPUT_FILE}"
)