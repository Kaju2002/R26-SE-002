# Required libraries
import pandas as pd

# Import the three modules
from src.skill_matching import run_skill_matching
from src.risk_aggregation import run_risk_aggregation
from src.ranking import run_ranking


def main():
    # Define user skills (will come from mobile app later)
    user_skills = [
        'employee relations', 'talent acquisition', 'performance management',
        'compensation and benefits', 'payroll processing', 'HR policies',
        'recruitment strategies', 'communication', 'interpersonal skills',
        'onboarding', 'training and development', 'compliance',
        'benefits administration', 'conflict resolution'
    ]

    # Module 1: Skill Matching
    print("Running Module 1: Skill Matching...")
    skill_results = run_skill_matching('data/raw/jobs.csv', user_skills)
    print(f"  -> Completed: {len(skill_results)} jobs scored")

    # Module 2: Risk Aggregation
    print("Running Module 2: Risk Aggregation...")
    risk_results, weights = run_risk_aggregation('data/raw/risk_indicators.csv')
    print(f"  -> Completed: {len(risk_results)} jobs scored")
    print(f"  -> EWM Weights - Fake Job: {weights['fake_job_num']:.3f}, "
          f"Employer: {weights['employer_num']:.3f}, "
          f"Comm Scam: {weights['comm_scam_num']:.3f}")

    # Module 3: TOPSIS Ranking
    print("Running Module 3: TOPSIS Ranking...")
    final_results = run_ranking(skill_results, risk_results)
    print(f"  -> Completed: {len(final_results)} jobs ranked")

    # Display top 10
    print("\n========== TOP 10 RECOMMENDED JOBS ==========\n")
    for rank, (_, row) in enumerate(final_results.head(10).iterrows(), start=1):
        print(f"Rank: {rank}")
        print(f"Job ID: {row['job_id']}")
        print(f"Job Title: {row['job_title']}")
        print(f"Skill Match: {row['skill_match_score']:.4f}")
        print(f"Safety: {row['safety_score']:.4f}")
        print(f"TOPSIS: {row['topsis_score']:.4f}")
        print("-" * 50)

    # Save final results
    final_results.to_csv('data/processed/final_recommendations.csv', index=False)
    print("\nFinal results saved to: data/processed/final_recommendations.csv")


if __name__ == '__main__':
    main()