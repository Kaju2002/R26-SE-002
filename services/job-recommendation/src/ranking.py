# Required libraries
import pandas as pd
import numpy as np


def run_ranking(skill_df, risk_df, skill_weight=0.5, safety_weight=0.5):
    """
    Run TOPSIS ranking combining skill and safety scores.
    
    Parameters:
        skill_df: DataFrame with job_id, job_title, skill_match_score
        risk_df: DataFrame with job_id, risk_score, safety_score
        skill_weight: weight for skill criterion (default 0.5)
        safety_weight: weight for safety criterion (default 0.5)
    
    Returns:
        DataFrame sorted by TOPSIS score (highest first)
    """
    # Merge skill and risk data
    job_scores = skill_df[['job_id', 'job_title', 'skill_match_score']].merge(
        risk_df[['job_id', 'risk_score', 'safety_score']], on='job_id'
    )

    # Build decision matrix
    skill = job_scores['skill_match_score'].values
    safety = job_scores['safety_score'].values
    decision_matrix = np.column_stack([skill, safety])

    # Normalize
    norm_matrix = decision_matrix / np.sqrt((decision_matrix ** 2).sum(axis=0))

    # Apply weights
    weights = np.array([skill_weight, safety_weight])
    weighted_matrix = norm_matrix * weights

    # Ideal and anti-ideal solutions
    ideal_best = np.max(weighted_matrix, axis=0)
    ideal_worst = np.min(weighted_matrix, axis=0)

    # Distances
    dist_best = np.sqrt(((weighted_matrix - ideal_best) ** 2).sum(axis=1))
    dist_worst = np.sqrt(((weighted_matrix - ideal_worst) ** 2).sum(axis=1))

    # Closeness coefficient
    job_scores['topsis_score'] = dist_worst / (dist_best + dist_worst)

    # Sort and return
    return job_scores.sort_values(by='topsis_score', ascending=False)


# Standalone test
if __name__ == '__main__':
    skill_scores = pd.read_csv('data/processed/skill_scores.csv')
    risk_scores = pd.read_csv('data/processed/risk_scores.csv')

    results = run_ranking(skill_scores, risk_scores)

    print("\n--- Top 10 Jobs (TOPSIS Ranking) ---\n")
    for rank, (_, row) in enumerate(results.head(10).iterrows(), start=1):
        print(f"Rank: {rank}")
        print(f"Job ID: {row['job_id']}")
        print(f"Job Title: {row['job_title']}")
        print(f"Skill Match: {row['skill_match_score']:.4f}")
        print(f"Safety Score: {row['safety_score']:.4f}")
        print(f"TOPSIS Score: {row['topsis_score']:.4f}")
        print("-" * 50)