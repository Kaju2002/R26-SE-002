# Required libraries
import pandas as pd
import ast

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def find_matched_skills(user_skills_list, job_skills_string):
    """
    Find which user skills matched in a job posting.
    Uses partial matching instead of exact matching.
    """

    # Convert user skills to lowercase
    user_lower = [s.lower() for s in user_skills_list]

    # Convert job skills string into list
    job_list = ast.literal_eval(job_skills_string)
    job_lower = [s.lower() for s in job_list]

    matched = []

    # Partial matching logic
    for user_skill in user_lower:
        for job_skill in job_lower:

            if (
                user_skill in job_skill
                or job_skill in user_skill
            ):
                matched.append(user_skill)
                break

    return matched


def run_skill_matching(jobs_path, user_skills):
    """
    Run the skill matching module.

    Parameters:
        jobs_path: path to jobs.csv
        user_skills: list of user skills (strings)

    Returns:
        DataFrame with:
        - job_id
        - job_title
        - skill_match_score
        - matched_skills
        - matched_count
    """

    # Load jobs dataset
    job_data = pd.read_csv(jobs_path)

    # Convert skill lists into lowercase text
    job_data['parsed_skills'] = job_data['job_skill_set'].apply(
        lambda x: ' '.join(ast.literal_eval(x))
    ).str.lower()

    # Convert user skills into single text
    user_text = ' '.join(user_skills).lower()

    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words='english'
    )

    all_texts = [user_text] + job_data['parsed_skills'].tolist()

    tfidf_matrix = vectorizer.fit_transform(all_texts)

    # Cosine similarity
    similarities = cosine_similarity(
        tfidf_matrix[0:1],
        tfidf_matrix[1:]
    ).flatten()

    # Build result dataframe
    job_data['skill_match_score'] = similarities

    results = job_data[
        [
            'job_id',
            'job_title',
            'skill_match_score',
            'job_skill_set'
        ]
    ].copy()

    # Find matched skills
    results['matched_skills'] = results['job_skill_set'].apply(
        lambda x: find_matched_skills(user_skills, x)
    )

    # Count matches
    results['matched_count'] = results['matched_skills'].apply(len)

    return results


# Standalone test
if __name__ == '__main__':

    user_skills = [
        'employee relations',
        'talent acquisition',
        'performance management',
        'compensation and benefits',
        'payroll processing',
        'HR policies',
        'recruitment strategies',
        'communication',
        'interpersonal skills',
        'onboarding',
        'training and development',
        'compliance',
        'benefits administration',
        'conflict resolution'
    ]

    # Run module
    results = run_skill_matching(
        'data/raw/jobs.csv',
        user_skills
    )

    # Top 10 recommendations
    top_results = results.sort_values(
        by='skill_match_score',
        ascending=False
    ).head(10)

    print("\n--- Top 10 Job Recommendations ---\n")

    for rank, (_, row) in enumerate(
        top_results.iterrows(),
        start=1
    ):

        print(f"Rank: {rank}")

        print(f"Record ID: {row['job_id']}")

        print(f"Job Title: {row['job_title']}")

        print(
            f"Skill Match Score: "
            f"{row['skill_match_score']:.4f}"
        )

        print(
            f"Matched Skills "
            f"({row['matched_count']}): "
            f"{', '.join(row['matched_skills'])}"
        )

        print("-" * 50)