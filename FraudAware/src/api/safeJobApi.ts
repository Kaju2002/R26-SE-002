import { getJobRecommendUrl, getLiveJobRecommendUrl } from '../config/jobRecommendationApi';

/** Shape returned by job-recommendation recommend endpoints. */
export type Recommendation = {
  /** CSV numeric id or Mongo ObjectId string */
  job_id: string;
  job_title: string;
  relevance: number;
  trust_score: number;
  overall_fit: number;
  skills_you_have: string[];
  skills_to_develop: string[];
};

export type LiveJobForRecommend = {
  id: string;
  title: string;
  skills?: string[];
  isVerified?: boolean;
  riskPrediction?: string;
  commIsScam?: boolean;
};

/**
 * Trim, drop empties, de-dupe (case-insensitive). Used before API calls
 * and by screens to decide whether skills are ready.
 */
export function normalizeRecommendationSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of skills) {
    const skill = String(raw ?? '').trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(skill);
  }

  return result;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function asScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRecommendation(raw: unknown): Recommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;

  const jobId = String(row.job_id ?? '').trim();
  const title = String(row.job_title ?? '').trim();
  if (!jobId || !title) return null;

  return {
    job_id: jobId,
    job_title: title,
    relevance: asScore(row.relevance),
    trust_score: asScore(row.trust_score),
    overall_fit: asScore(row.overall_fit),
    skills_you_have: asStringList(row.skills_you_have),
    skills_to_develop: asStringList(row.skills_to_develop),
  };
}

async function parseRecommendationList(response: Response): Promise<Recommendation[]> {
  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { detail?: string; message?: string };
      detail = body.detail || body.message || '';
    } catch {
      // ignore parse errors
    }
    throw new Error(
      detail || `Could not load recommendations (${response.status}).`
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected recommendation response.');
  }

  return payload
    .map(normalizeRecommendation)
    .filter((item): item is Recommendation => item !== null);
}

/**
 * CSV dataset recommendations (legacy / evaluation). Prefer live for the app.
 */
export async function fetchRecommendations(
  skills: string[]
): Promise<Recommendation[]> {
  const normalizedSkills = normalizeRecommendationSkills(skills);
  if (normalizedSkills.length === 0) {
    throw new Error('Add at least one skill to get recommendations.');
  }

  const response = await fetch(getJobRecommendUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ skills: normalizedSkills }),
  });

  return parseRecommendationList(response);
}

/**
 * Rank live job-management jobs against profile skills.
 */
export async function fetchLiveRecommendations(
  skills: string[],
  jobs: LiveJobForRecommend[],
  limit = 20
): Promise<Recommendation[]> {
  const normalizedSkills = normalizeRecommendationSkills(skills);
  if (normalizedSkills.length === 0) {
    throw new Error('Add at least one skill to get recommendations.');
  }

  if (jobs.length === 0) {
    return [];
  }

  const response = await fetch(getLiveJobRecommendUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      skills: normalizedSkills,
      limit,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        skills: job.skills ?? [],
        isVerified: Boolean(job.isVerified),
        riskPrediction: job.riskPrediction,
        commIsScam: job.commIsScam,
      })),
    }),
  });

  return parseRecommendationList(response);
}
