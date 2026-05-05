# Required libraries
import pandas as pd
import numpy as np

# Load skill match scores from Module 1
skill_scores = pd.read_csv('data/processed/skill_scores.csv')

# Load risk scores from Module 2
risk_scores = pd.read_csv('data/processed/risk_scores.csv')

# Merge both datasets on job_id
job_scores = skill_scores.merge(risk_scores[['job_id', 'risk_score', 'safety_score']], on='job_id')

# Check what we have
print("Shape:", job_scores.shape)
print("\nColumns:", job_scores.columns.tolist())
print("\nFirst 5 rows:")
print(job_scores[['job_id', 'job_title', 'skill_match_score', 'safety_score']].head())

# Extract the two criteria columns
# Both are benefit criteria (higher = better)
skill = job_scores['skill_match_score'].values
safety = job_scores['safety_score'].values

# Create decision matrix (1167 rows × 2 columns)
decision_matrix = np.column_stack([skill, safety])

print("Decision matrix shape:", decision_matrix.shape)
print("\nFirst 5 rows of decision matrix:")
print(decision_matrix[:5])

# ------------------------------------------------------------
# TOPSIS CALCULATION
# ------------------------------------------------------------

# Step 3a: Normalize the decision matrix
# Each value divided by the square root of sum of squares in its column
norm_matrix = decision_matrix / np.sqrt((decision_matrix ** 2).sum(axis=0))

# Step 3b: Apply equal weights to both criteria
# skill = 0.5, safety = 0.5
weights = np.array([0.5, 0.5])
weighted_matrix = norm_matrix * weights

# Step 3c: Determine ideal and anti-ideal solutions
# Both criteria are benefit criteria (higher is better)
ideal_best = np.max(weighted_matrix, axis=0)
ideal_worst = np.min(weighted_matrix, axis=0)

# Step 3d: Calculate distances
# Euclidean distance to ideal best
dist_best = np.sqrt(((weighted_matrix - ideal_best) ** 2).sum(axis=1))
# Euclidean distance to ideal worst
dist_worst = np.sqrt(((weighted_matrix - ideal_worst) ** 2).sum(axis=1))

# Step 3e: Calculate closeness coefficient
# Closer to 1 = better overall
closeness = dist_worst / (dist_best + dist_worst)

# Add TOPSIS score to the DataFrame
job_scores['topsis_score'] = closeness

# Sort and display top 10
top_results = job_scores.sort_values(by='topsis_score', ascending=False).head(10)

print("\n--- Top 10 Jobs (TOPSIS Ranking) ---\n")
for rank, (_, row) in enumerate(top_results.iterrows(), start=1):
    print(f"Rank: {rank}")
    print(f"Job ID: {row['job_id']}")
    print(f"Job Title: {row['job_title']}")
    print(f"Skill Match: {row['skill_match_score']:.4f}")
    print(f"Safety Score: {row['safety_score']:.4f}")
    print(f"TOPSIS Score: {row['topsis_score']:.4f}")
    print("-" * 50)

    