import pandas as pd
import ast
import random

# ===================================================
# Configuration
# ===================================================

INPUT_FILE = "data/raw/jobs.csv"
OUTPUT_FILE = "evaluation/datasets/test_users.csv"

USERS_PER_DOMAIN = 10
MIN_SKILLS = 3
MAX_REMOVE = 2

random.seed(42)

# ===================================================
# Load Dataset
# ===================================================

jobs = pd.read_csv(INPUT_FILE)

jobs = jobs.dropna(subset=["job_skill_set"])

print(f"Total Jobs : {len(jobs)}")

# ===================================================
# Display Domain Distribution
# ===================================================

print("\nJob Domain Distribution")

domain_counts = jobs["category"].value_counts()

for domain, count in domain_counts.items():
    print(f"{domain:<25} : {count}")

# ===================================================
# Generate Users
# ===================================================

test_users = []
user_id = 1

for domain in domain_counts.index:

    print(f"\nGenerating users for: {domain}")

    domain_jobs = jobs[jobs["category"] == domain]

    # Randomly select jobs from this domain
    sampled_jobs = domain_jobs.sample(
        n=min(USERS_PER_DOMAIN, len(domain_jobs)),
        random_state=42
    )

    for _, row in sampled_jobs.iterrows():

        try:
            skills = ast.literal_eval(row["job_skill_set"])
        except Exception:
            continue

        # Remove duplicates
        skills = list(dict.fromkeys(skills))

        # Shuffle
        random.shuffle(skills)

        # Randomly remove 0–2 skills
        remove_count = random.randint(0, MAX_REMOVE)

        if remove_count > 0 and len(skills) - remove_count >= MIN_SKILLS:
            skills = skills[:-remove_count]

        test_users.append({

            "user_id": user_id,

            "domain": row["category"],

            "source_job_id": row["job_id"],

            "source_job_title": row["job_title"],

            "skills": ", ".join(skills)

        })

        user_id += 1

# ===================================================
# Save CSV
# ===================================================

test_users_df = pd.DataFrame(test_users)

test_users_df.to_csv(
    OUTPUT_FILE,
    index=False
)

print("\n--------------------------------------------")
print("Test Users Generated Successfully!")
print("--------------------------------------------")

print(f"Total Test Users : {len(test_users_df)}")

print("\nUsers per Domain")

print(test_users_df["domain"].value_counts())

print(f"\nSaved to: {OUTPUT_FILE}")