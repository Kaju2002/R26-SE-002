# Required libraries
import pandas as pd
import ast
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Load the dataset
job_data = pd.read_csv('data/raw/jobs.csv')

# Check dataset dimensions (rows, columns)
print("Shape:", job_data.shape)

# Display column names
print("Columns:", job_data.columns.tolist())

# Check for missing values across all columns
print("\nMissing values in each column:")
print(job_data.isnull().sum())

# Examine the structure of the job_skill_set column
sample_skills = job_data.iloc[0]['job_skill_set']
print("\nData type of job_skill_set:", type(sample_skills))
print("Sample entry (first job):")
print(sample_skills)

# Convert job_skill_set from string to actual list, then join into a single string
job_data['parsed_skills'] = job_data['job_skill_set'].apply(
    lambda x: ' '.join(ast.literal_eval(x))
)

# Convert all text to lowercase for consistent matching
job_data['parsed_skills'] = job_data['parsed_skills'].str.lower()

# Show before and after for the first job
print("\nBefore preprocessing:")
print(job_data.iloc[0]['job_skill_set'])
print("\nAfter preprocessing:")
print(job_data.iloc[0]['parsed_skills'])

# Initialize the TF-IDF vectorizer
vectorizer = TfidfVectorizer(lowercase=True, stop_words='english')

# Create a sample user profile for testing
user_skills = [
    'employee relations', 'talent acquisition', 'performance management',
    'compensation and benefits', 'payroll processing', 'HR policies',
    'recruitment strategies', 'communication', 'interpersonal skills',
    'onboarding', 'training and development', 'compliance',
    'benefits administration', 'conflict resolution'
]

# Join user skills into a single string (same format as parsed_skills)
user_text = ' '.join(user_skills)

# Combine user text with all job texts into one list
all_texts = [user_text] + job_data['parsed_skills'].tolist()

# Convert all text to TF-IDF matrix
tfidf_matrix = vectorizer.fit_transform(all_texts)

# Calculate similarity between user (row 0) and all jobs (rows 1 to end)
similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])

# Convert to a 1D array (one score per job)
similarities = similarities.flatten()

# Add similarity scores to the DataFrame
job_data['skill_match_score'] = similarities

# Function to find which user skills matched in each job
def find_matched_skills(user_skills_list, job_skills_string):
    user_lower = [s.lower() for s in user_skills_list]
    job_list = ast.literal_eval(job_skills_string)
    job_lower = [s.lower() for s in job_list]
    matched = [s for s in user_lower if s in job_lower]
    return matched

# Build results with matched skills
results = job_data[['job_id', 'job_title', 'skill_match_score', 'job_skill_set']].copy()
results['matched_skills'] = results['job_skill_set'].apply(
    lambda x: find_matched_skills(user_skills, x)
)
results['matched_count'] = results['matched_skills'].apply(len)

# Sort and display top 10 recommendations
top_results = results.sort_values(by='skill_match_score', ascending=False).head(10)

print("\n--- Top 10 Job Recommendations ---\n")
for rank, (_, row) in enumerate(top_results.iterrows(), start=1):
    print(f"Rank: {rank}")
    print(f"Record ID: {row['job_id']}")
    print(f"Job Title: {row['job_title']}")
    print(f"Skill Match Score: {row['skill_match_score']:.4f}")
    print(f"Matched Skills ({row['matched_count']}): {', '.join(row['matched_skills'])}")
    print("-" * 50)

# Save skill match results for use by Module 3
results.to_csv('data/processed/skill_scores.csv', index=False)

print("\nSkill scores saved to: data/processed/skill_scores.csv")