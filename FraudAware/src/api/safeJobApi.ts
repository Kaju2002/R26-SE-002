export interface Recommendation {
  job_id: number;
  job_title: string;
  relevance: number;
  trust_score: number;
  overall_fit: number;
  skills_you_have: string[];
  skills_to_develop: string[];
}

//const API_URL = 'http://172.20.10.2:8000/recommend';
const API_URL = 'http://localhost:8000/recommend';

export async function fetchRecommendations(
  skills: string[]
): Promise<Recommendation[]> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      skills,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch recommendations');
  }

  return response.json();
}