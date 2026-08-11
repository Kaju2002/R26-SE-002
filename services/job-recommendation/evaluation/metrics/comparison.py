import pandas as pd


# ===================================================
# File Paths
# ===================================================

RELEVANCE_FILE = (
    "evaluation/evaluation_outputs/"
    "relevance_metrics.csv"
)

SAFETY_FILE = (
    "evaluation/evaluation_outputs/"
    "safety_metrics.csv"
)

OUTPUT_FILE = (
    "evaluation/evaluation_outputs/"
    "final_comparison.csv"
)


# ===================================================
# Load Metric Results
# ===================================================

relevance = pd.read_csv(
    RELEVANCE_FILE
)

safety = pd.read_csv(
    SAFETY_FILE
)


# ===================================================
# Prepare Relevance Results
# ===================================================

relevance_results = relevance[
    [
        "Metric",
        "Baseline",
        "Proposed",
        "Difference"
    ]
].copy()

relevance_results["Evaluation"] = "Relevance"


# Rename difference column
relevance_results = (
    relevance_results
    .rename(
        columns={
            "Difference":
                "Absolute Change"
        }
    )
)


# ===================================================
# Prepare Safety Results
# ===================================================

safety_results = safety[
    [
        "Metric",
        "Baseline",
        "Proposed",
        "Percentage Change"
    ]
].copy()

safety_results["Evaluation"] = "Safety"

# Safety file already contains percentage change.
# Calculate absolute change as well.

safety_results["Absolute Change"] = (
    safety_results["Proposed"]
    - safety_results["Baseline"]
)


# ===================================================
# Combine Results
# ===================================================

final_results = pd.concat(
    [
        relevance_results[
            [
                "Evaluation",
                "Metric",
                "Baseline",
                "Proposed",
                "Absolute Change"
            ]
        ],

        safety_results[
            [
                "Evaluation",
                "Metric",
                "Baseline",
                "Proposed",
                "Absolute Change",
                "Percentage Change"
            ]
        ]
    ],
    ignore_index=True
)


# ===================================================
# Add Percentage Change for Relevance
# ===================================================

final_results["Percentage Change"] = (
    final_results["Percentage Change"]
    if "Percentage Change"
    in final_results.columns
    else None
)

for index, row in final_results.iterrows():

    if row["Evaluation"] == "Relevance":

        baseline = row["Baseline"]
        proposed = row["Proposed"]

        if baseline != 0:

            percentage_change = (
                (proposed - baseline)
                / baseline
                * 100
            )

            final_results.loc[
                index,
                "Percentage Change"
            ] = percentage_change


# ===================================================
# Round Values
# ===================================================

final_results["Baseline"] = (
    final_results["Baseline"]
    .round(4)
)

final_results["Proposed"] = (
    final_results["Proposed"]
    .round(4)
)

final_results["Absolute Change"] = (
    final_results["Absolute Change"]
    .round(4)
)

final_results["Percentage Change"] = (
    final_results["Percentage Change"]
    .round(2)
)


# ===================================================
# Add Direction
# ===================================================

higher_is_better = {
    "Precision@10": True,
    "AP@10": True,
    "MRR@10": True,
    "NDCG@10": True,
    "Average Safety@10": True,

    "Average Risk@10": False,
    "Unsafe Rate@10": False
}


final_results["Better Direction"] = (
    final_results["Metric"]
    .map(higher_is_better)
    .map({
        True: "Higher",
        False: "Lower"
    })
)


# ===================================================
# Save Final Comparison
# ===================================================

final_results.to_csv(
    OUTPUT_FILE,
    index=False
)


# ===================================================
# Display Results
# ===================================================

print("----------------------------------------")
print("Final Baseline vs Proposed Comparison")
print("----------------------------------------")

print(
    final_results.to_string(
        index=False
    )
)


print("\n----------------------------------------")
print("Comparison Complete!")
print("----------------------------------------")

print(
    f"Saved To: {OUTPUT_FILE}"
)