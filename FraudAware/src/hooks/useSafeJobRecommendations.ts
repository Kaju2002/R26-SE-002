import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Job } from '../../data/jobs';
import { useProfile } from '../context/ProfileContext';
import { listJobs } from '../api/jobApi';
import { mapApiJobsToJobs } from '../utils/jobMapper';
import {
  fetchLiveRecommendations,
  normalizeRecommendationSkills,
  type Recommendation,
} from '../api/safeJobApi';

export type RecommendationsStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'
  | 'needs_skills';

export type RankedJob = Job & {
  rank: number;
  overallFit: number;
};

/**
 * Loads ranked live Mongo jobs using profile skills.
 * Returns full Job objects (for JobCard) in recommendation order.
 */
export function useSafeJobRecommendations(limit?: number) {
  const { details, isLoading: profileLoading } = useProfile();

  const skills = useMemo(
    () => normalizeRecommendationSkills(details.skills),
    [details.skills]
  );

  const [items, setItems] = useState<Recommendation[]>([]);
  const [jobs, setJobs] = useState<RankedJob[]>([]);
  const [status, setStatus] = useState<RecommendationsStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (skills.length === 0) {
      setItems([]);
      setJobs([]);
      setErrorMessage(null);
      setStatus('needs_skills');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const listed = await listJobs({ sort: 'newly_posted', limit: 50 });
      const apiJobs = listed.jobs;
      const mapped = mapApiJobsToJobs(apiJobs);
      const byId = new Map(mapped.map((job) => [job.id, job]));

      const liveJobs = apiJobs.map((job) => ({
        id: job.id,
        title: job.title,
        skills: job.skills ?? [],
        isVerified: Boolean(job.isVerified),
        riskPrediction: job.riskCheck?.prediction ?? 'legitimate',
      }));

      const ranked = await fetchLiveRecommendations(
        skills,
        liveJobs,
        limit ?? 20
      );

      const rankedJobs: RankedJob[] = ranked
        .map((rec, index) => {
          const job = byId.get(rec.job_id);
          if (!job) return null;
          return {
            ...job,
            rank: index + 1,
            overallFit: rec.overall_fit,
            matchScore: Math.round(rec.overall_fit * 100),
          };
        })
        .filter((job): job is RankedJob => job !== null);

      setItems(ranked);
      setJobs(rankedJobs);
      setStatus('success');
    } catch (error) {
      setItems([]);
      setJobs([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load recommendations.'
      );
      setStatus('error');
    }
  }, [skills, limit]);

  useEffect(() => {
    if (profileLoading) return;
    void reload();
  }, [profileLoading, reload]);

  return {
    skills,
    items,
    jobs,
    status,
    errorMessage,
    profileLoading,
    reload,
    isLoading: profileLoading || status === 'loading' || status === 'idle',
  };
}
