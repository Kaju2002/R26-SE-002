# Required libraries
import pandas as pd
import numpy as np


def run_risk_aggregation(risk_path):
    """
    Run the risk aggregation module using Entropy Weight Method.
    
    Parameters:
        risk_path: path to risk_indicators.csv
    
    Returns:
        DataFrame with job_id, risk_score, safety_score, and weights
    """
    # Load risk indicators
    risk_data = pd.read_csv(risk_path)

    # Map text labels to numeric values
    mapping = {
        'Not Fake': 0, 'Suspicious': 0.5, 'Fake': 1,
        'Legitimate Company': 0, 'Fake Company': 1,
        'Not Scam': 0, 'Scam': 1
    }

    risk_data['fake_job_num'] = risk_data['fake_job_indicator'].map(mapping)
    risk_data['employer_num'] = risk_data['employer_indicator'].map(mapping)
    risk_data['comm_scam_num'] = risk_data['comm_scam_indicator'].map(mapping)

    # Extract numeric indicator columns
    indicators = risk_data[['fake_job_num', 'employer_num', 'comm_scam_num']]

    # Min-max normalization
    normalized = (indicators - indicators.min()) / (indicators.max() - indicators.min())

    # Convert to proportions for entropy calculation
    proportions = normalized / normalized.sum()
    proportions = proportions.replace(0, 1e-10)  # avoid log(0)

    # Entropy calculation
    n_rows = len(indicators)
    k = 1 / np.log(n_rows)
    entropy = -k * (proportions * np.log(proportions)).sum()

    # Calculate weights
    d = 1 - entropy
    weights = d / d.sum()

    # Weighted risk score
    risk_data['risk_score'] = (
        risk_data['fake_job_num'] * weights['fake_job_num'] +
        risk_data['employer_num'] * weights['employer_num'] +
        risk_data['comm_scam_num'] * weights['comm_scam_num']
    )

    # Safety score (inverse of risk)
    risk_data['safety_score'] = 1 - risk_data['risk_score']

    return risk_data[['job_id', 'risk_score', 'safety_score']], weights


# Standalone test
if __name__ == '__main__':
    result, weights = run_risk_aggregation('data/raw/risk_indicators.csv')

    print("--- EWM Weights ---")
    print(f"Fake Job Detection: {weights['fake_job_num']:.4f}")
    print(f"Employer Legitimacy: {weights['employer_num']:.4f}")
    print(f"Communication Scam: {weights['comm_scam_num']:.4f}")

    print("\n--- Risk vs Safety Scores (first 10 jobs) ---")
    print(result.head(10))