# Required libraries
import pandas as pd
import ast
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def find_matched_skills(user_skills_list, job_skills_string):
    """Find which user skills matched in a job posting."""
    user_lower = [s.lower() for s in user_skills_list]
    job_list = ast.literal_eval(job_skills_string)
    job_lower = [s.lower() for s in job_list]
    matched = [s for s in user_lower if s in job_lower]
    return matched


def run_skill_matching(jobs_path, user_skills):
    """
    Run the skill matching module.
    
    Parameters:
        jobs_path: path to jobs.csv
        user_skills: list of user skills (strings)
    
    Returns:
        DataFrame with job_id, job_title, skill_match_score, matched_skills, matched_count
    """
    # Load jobs dataset
    job_data = pd.read_csv(jobs_path)

    # Convert skill strings to space-separated lowercase text
    job_data['parsed_skills'] = job_data['job_skill_set'].apply(
        lambda x: ' '.join(ast.literal_eval(x))
    ).str.lower()

    # Join user skills into a single string
    user_text = ' '.join(user_skills)

    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(lowercase=True, stop_words='english')
    all_texts = [user_text] + job_data['parsed_skills'].tolist()
    tfidf_matrix = vectorizer.fit_transform(all_texts)

    # Cosine similarity between user and all jobs
    similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()

    # Build results
    job_data['skill_match_score'] = similarities
    results = job_data[['job_id', 'job_title', 'skill_match_score', 'job_skill_set']].copy()
    results['matched_skills'] = results['job_skill_set'].apply(
        lambda x: find_matched_skills(user_skills, x)
    )
    results['matched_count'] = results['matched_skills'].apply(len)

    return results


# Standalone test
if __name__ == '__main__':
    user_skills = [
        'employee relations', 'talent acquisition', 'performance management',
        'compensation and benefits', 'payroll processing', 'HR policies',
        'recruitment strategies', 'communication', 'interpersonal skills',
        'onboarding', 'training and development', 'compliance',
        'benefits administration', 'conflict resolution'
    ]

    results = run_skill_matching('data/raw/jobs.csv', user_skills)

    # Display top 10
    top_results = results.sort_values(by='skill_match_score', ascending=False).head(10)

    print("\n--- Top 10 Job Recommendations ---\n")
    for rank, (_, row) in enumerate(top_results.iterrows(), start=1):
        print(f"Rank: {rank}")
        print(f"Record ID: {row['job_id']}")
        print(f"Job Title: {row['job_title']}")
        print(f"Skill Match Score: {row['skill_match_score']:.4f}")
        print(f"Matched Skills ({row['matched_count']}): {', '.join(row['matched_skills'])}")
        print("-" * 50)