import pandas as pd


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


# ===================================================
# Load Files
# ===================================================

ground_truth = pd.read_csv(GROUND_TRUTH_FILE)
baseline = pd.read_csv(BASELINE_FILE)
proposed = pd.read_csv(PROPOSED_FILE)


errors = []


# ===================================================
# 1. Check Number of Users
# ===================================================

user_count = ground_truth["user_id"].nunique()

if user_count != 50:
    errors.append(
        f"Expected 50 users, found {user_count}"
    )


# ===================================================
# 2. Check Duplicate User-Job Pairs
# ===================================================

duplicates = ground_truth.duplicated(
    subset=["user_id", "job_id"]
).sum()

if duplicates > 0:
    errors.append(
        f"Found {duplicates} duplicate "
        f"user-job pairs"
    )


# ===================================================
# 3. Check Missing Relevance
# ===================================================

missing_relevance = (
    ground_truth["relevance"].isna()
    |
    (
        ground_truth["relevance"]
        .astype(str)
        .str.strip()
        == ""
    )
).sum()

if missing_relevance > 0:
    errors.append(
        f"Found {missing_relevance} missing "
        f"relevance labels"
    )


# ===================================================
# 4. Check Relevance Values
# ===================================================

valid_values = {0, 1, 2, 3}

# Convert numeric-looking values safely
relevance_numeric = pd.to_numeric(
    ground_truth["relevance"],
    errors="coerce"
)

invalid_relevance = (
    relevance_numeric.isna()
    |
    ~relevance_numeric.isin(valid_values)
).sum()

if invalid_relevance > 0:
    errors.append(
        f"Found {invalid_relevance} invalid "
        f"relevance values"
    )


# ===================================================
# 5. Check Missing Job Information
# ===================================================

job_columns = [
    "job_id",
    "job_title",
    "category",
    "job_skill_set",
    "job_description"
]

for column in job_columns:

    missing = ground_truth[column].isna().sum()

    if missing > 0:
        errors.append(
            f"Column '{column}' has "
            f"{missing} missing values"
        )


# ===================================================
# 6. Check Candidates Against Recommendations
# ===================================================

baseline_pairs = set(
    zip(
        baseline["user_id"],
        baseline["job_id"]
    )
)

proposed_pairs = set(
    zip(
        proposed["user_id"],
        proposed["job_id"]
    )
)

valid_pairs = (
    baseline_pairs
    |
    proposed_pairs
)


ground_truth_pairs = set(
    zip(
        ground_truth["user_id"],
        ground_truth["job_id"]
    )
)


unexpected_pairs = (
    ground_truth_pairs - valid_pairs
)

if len(unexpected_pairs) > 0:

    errors.append(
        f"Found {len(unexpected_pairs)} "
        f"ground-truth pairs that were not "
        f"in Baseline or Proposed Top-10"
    )


# ===================================================
# Results
# ===================================================

print("----------------------------------------")
print("Ground Truth Validation")
print("----------------------------------------")

print(
    f"Users              : "
    f"{ground_truth['user_id'].nunique()}"
)

print(
    f"Records            : "
    f"{len(ground_truth)}"
)

print(
    f"Duplicate Pairs    : "
    f"{duplicates}"
)

print(
    f"Missing Relevance  : "
    f"{missing_relevance}"
)

print(
    f"Invalid Relevance  : "
    f"{invalid_relevance}"
)

print(
    f"Unexpected Pairs   : "
    f"{len(unexpected_pairs)}"
)


print("\n----------------------------------------")
print("Relevance Distribution")
print("----------------------------------------")

print(
    relevance_numeric
    .value_counts()
    .sort_index()
)


# ===================================================
# Final Status
# ===================================================

print("\n----------------------------------------")

if len(errors) == 0:

    print("VALIDATION PASSED")
    print("----------------------------------------")
    print(
        "Ground truth is ready for "
        "relevance evaluation."
    )

else:

    print("VALIDATION FAILED")
    print("----------------------------------------")

    for error in errors:
        print(f"- {error}")