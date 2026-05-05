import pandas as pd
import numpy as np

np.random.seed(42)

# Read actual job IDs from jobs.csv
jobs = pd.read_csv('data/raw/jobs.csv')
n = len(jobs)
job_ids = jobs['job_id'].tolist()

fake_job = np.random.choice(
    ['Not Fake', 'Suspicious', 'Fake'],
    size=n,
    p=[0.80, 0.10, 0.10]
)

employer = np.random.choice(
    ['Legitimate Company', 'Fake Company'],
    size=n,
    p=[0.85, 0.15]
)

comm_scam = np.random.choice(
    ['Not Scam', 'Scam'],
    size=n,
    p=[0.95, 0.05]
)

risk_data = pd.DataFrame({
    'job_id': job_ids,
    'fake_job_indicator': fake_job,
    'employer_indicator': employer,
    'comm_scam_indicator': comm_scam
})

risk_data.to_csv('data/raw/risk_indicators.csv', index=False)

print("Dataset generated: data/raw/risk_indicators.csv")
print(f"Total rows: {len(risk_data)}")
print("\nValue distribution per column:\n")
for col in risk_data.columns[1:]:
    print(f"--- {col} ---")
    print(risk_data[col].value_counts())
    print()