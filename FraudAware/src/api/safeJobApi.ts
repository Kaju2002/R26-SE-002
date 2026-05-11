import { getJobRecommendUrl } from '../config/jobRecommendationApi';

export interface Recommendation {
  job_id: number;
  job_title: string;
  relevance: number;
  trust_score: number;
  overall_fit: number;
  skills_you_have: string[];
  skills_to_develop: string[];
}

export async function fetchRecommendations(
  skills: string[]
): Promise<Recommendation[]> {
  const response = await fetch(getJobRecommendUrl(), {
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