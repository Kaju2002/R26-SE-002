# Required libraries
import pandas as pd
import numpy as np

# Load the risk indicators dataset
risk_data = pd.read_csv('data/raw/risk_indicators.csv')

# Check dataset dimensions
print("Shape:", risk_data.shape)

# Display first few rows
print("\nFirst 5 rows:")
print(risk_data.head())

# Check unique values and their counts for each indicator column
print("\n--- Fake Job Indicator ---")
print(risk_data['fake_job_indicator'].value_counts())

print("\n--- Employer Indicator ---")
print(risk_data['employer_indicator'].value_counts())

print("\n--- Communication Scam Indicator ---")
print(risk_data['comm_scam_indicator'].value_counts())

# Convert text labels to numeric values
# This is needed because EWM works with numbers, not text
mapping = {
    'Not Fake': 0, 'Suspicious': 0.5, 'Fake': 1,
    'Legitimate Company': 0, 'Fake Company': 1,
    'Not Scam': 0, 'Scam': 1
}

# Create numeric versions of each column
risk_data['fake_job_num'] = risk_data['fake_job_indicator'].map(mapping)
risk_data['employer_num'] = risk_data['employer_indicator'].map(mapping)
risk_data['comm_scam_num'] = risk_data['comm_scam_indicator'].map(mapping)

# Show before and after for first 5 rows
print("\nBefore preprocessing:")
print(risk_data[['job_id', 'fake_job_indicator', 'employer_indicator', 'comm_scam_indicator']].head())
print("\nAfter preprocessing:")
print(risk_data[['job_id', 'fake_job_num', 'employer_num', 'comm_scam_num']].head())

# ------------------------------------------------------------
# ENTROPY WEIGHT METHOD
# ------------------------------------------------------------

# Extract only the numeric indicator columns
indicators = risk_data[['fake_job_num', 'employer_num', 'comm_scam_num']]

# Step 1: Normalize each column to [0,1] range
# Min-max normalization: (x - min) / (max - min)
normalized = (indicators - indicators.min()) / (indicators.max() - indicators.min())

# Step 2: Convert to proportions (each value divided by column sum)
proportions = normalized / normalized.sum()

# Step 3: Calculate entropy for each indicator
# Entropy measures randomness — higher entropy = less useful
n_rows = len(indicators)
k = 1 / np.log(n_rows)  # Constant for entropy formula

# Replace 0 with tiny number to avoid log(0) error
proportions = proportions.replace(0, 1e-10)

# H = -k * sum(p * ln(p))
entropy = -k * (proportions * np.log(proportions)).sum()

# Step 4: Calculate weights
# d = degree of diversification (1 - entropy)
# Weight = d / sum(d)
d = 1 - entropy
weights = d / d.sum()

print("\n--- EWM Weights ---")
print(f"Fake Job Detection: {weights['fake_job_num']:.4f}")
print(f"Employer Legitimacy: {weights['employer_num']:.4f}")
print(f"Communication Scam: {weights['comm_scam_num']:.4f}")

# ------------------------------------------------------------
# STEP 5: CALCULATE RISK SCORE FOR EACH JOB
# ------------------------------------------------------------

# Weighted sum: each indicator multiplied by its EWM weight
risk_data['risk_score'] = (
    risk_data['fake_job_num'] * weights['fake_job_num'] +
    risk_data['employer_num'] * weights['employer_num'] +
    risk_data['comm_scam_num'] * weights['comm_scam_num']
)

# Show sample results
print("\n--- Risk Scores (first 10 jobs) ---")
print(risk_data[['job_id', 'fake_job_num', 'employer_num', 'comm_scam_num', 'risk_score']].head(10))

# Convert risk score to safety score
# Safety = 1 - Risk (so higher safety = better)
risk_data['safety_score'] = 1 - risk_data['risk_score']

# Show comparison
print("\n--- Risk vs Safety Scores (first 10 jobs) ---")
print(risk_data[['job_id', 'risk_score', 'safety_score']].head(10))

# Save processed risk data for later use by Module 3
risk_data.to_csv('data/processed/risk_scores.csv', index=False)

print("\nRisk scores saved to: data/processed/risk_scores.csv")
print(f"Total jobs scored: {len(risk_data)}")