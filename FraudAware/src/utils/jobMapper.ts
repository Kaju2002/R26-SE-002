import type { Job } from '../../data/jobs';
import type { ApiApplication, ApiJob } from '../api/jobApi';

/** Map job-management API shape to frontend Job (used by cards & detail screens). */
export function mapApiJobToJob(apiJob: ApiJob, applicationId?: string): Job {
  return {
    id: apiJob.id,
    title: apiJob.title,
    companyName: apiJob.companyName,
    companyLogo: apiJob.companyLogoUri
      ? { uri: apiJob.companyLogoUri }
      : undefined,
    companyFallback: apiJob.companyFallback,
    isVerified: apiJob.isVerified,
    location: apiJob.location,
    postedAt: apiJob.postedAt,
    endsAt: apiJob.endsAt,
    salaryMin: apiJob.salaryMin,
    salaryMax: apiJob.salaryMax,
    salaryCurrency: apiJob.salaryCurrency,
    salaryPeriod: apiJob.salaryPeriod,
    type: apiJob.type,
    mode: apiJob.mode,
    matchScore: apiJob.matchScore,
    applicationStatus: apiJob.applicationStatus,
    applicants: apiJob.applicants,
    description: apiJob.description,
    requirements: apiJob.requirements,
    benefits: apiJob.benefits,
    skills: apiJob.skills,
    perks: apiJob.perks,
    jobLevel: apiJob.jobLevel,
    education: apiJob.education,
    experience: apiJob.experience,
    about: apiJob.about,
    contact: apiJob.contact,
    postedBy: apiJob.postedBy,
    applicationId,
  };
}

export function mapApiJobsToJobs(apiJobs: ApiJob[]): Job[] {
  return apiJobs.map((job) => mapApiJobToJob(job));
}

/** Join applied jobs with their application ids (needed to open InChat). */
export function mapAppliedJobsToJobs(
  apiJobs: ApiJob[],
  applications: ApiApplication[]
): Job[] {
  const applicationIdByJobId = Object.fromEntries(
    applications.map((application) => [application.jobId, application.id])
  );

  return apiJobs.map((job) => mapApiJobToJob(job, applicationIdByJobId[job.id]));
}
