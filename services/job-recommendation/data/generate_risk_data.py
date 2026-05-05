# ============================================================
# Generate dummy risk indicators dataset for testing Module 2
# One-time utility — run once to create risk_indicators.csv
# ============================================================

import pandas as pd
import numpy as np

# Fix the random seed so results are reproducible
np.random.seed(42)

# Number of rows to generate
n = 500

# Create job IDs (simple sequential numbers)
job_ids = list(range(1, n + 1))

# Generate fake job detection indicator
fake_job = np.random.choice(
    ['Not Fake', 'Suspicious', 'Fake'],
    size=n,
    p=[0.80, 0.10, 0.10]
)

# Generate employer legitimacy indicator
employer = np.random.choice(
    ['Legitimate Company', 'Fake Company'],
    size=n,
    p=[0.85, 0.15]
)

# Generate communication scam indicator
comm_scam = np.random.choice(
    ['Not Scam', 'Scam'],
    size=n,
    p=[0.95, 0.05]
)

# Combine all columns into a single DataFrame
risk_data = pd.DataFrame({
    'job_id': job_ids,
    'fake_job_indicator': fake_job,
    'employer_indicator': employer,
    'comm_scam_indicator': comm_scam
})

# Save to CSV
risk_data.to_csv('data/raw/risk_indicators.csv', index=False)

# Display summary of generated data
print("Dataset generated: data/raw/risk_indicators.csv")
print(f"Total rows: {len(risk_data)}")
print("\nValue distribution per column:\n")
for col in risk_data.columns[1:]:
    print(f"--- {col} ---")
    print(risk_data[col].value_counts())
    print()