import pandas as pd

# ============================================
# File Paths
# ============================================

RECOMMENDATIONS_FILE = "evaluation/results/recommendations.csv"
OUTPUT_FILE = "evaluation/datasets/ground_truth.csv"

# ============================================
# Load Recommendations
# ============================================

recommendations = pd.read_csv(RECOMMENDATIONS_FILE)

# ============================================
# Select Required Columns
# ============================================

ground_truth = recommendations[
    [
        "user_id",
        "user_domain",
        "rank",
        "job_id",
        "job_title",
        "job_category"
    ]
].copy()

# Add empty column for manual labeling
ground_truth["relevant"] = ""

# ============================================
# Save Ground Truth File
# ============================================

ground_truth.to_csv(
    OUTPUT_FILE,
    index=False
)

print("----------------------------------------")
print("Ground Truth File Created Successfully!")
print("----------------------------------------")
print(f"Total Records : {len(ground_truth)}")
print(f"Saved To      : {OUTPUT_FILE}")