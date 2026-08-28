import { authHeaders, getJobManagementBaseUrl } from './apiConfig';
import type { ApplicationStatus } from '../../data/applicationNotifications';
import type { Job, JobContact, JobMode, JobType } from '../../data/jobs';
import type { LogoFallbackData } from '../types/profile';
import { appendDocumentField, appendFormField, appendImageField } from '../utils/formDataHelpers';
import type { SortOption } from '../components/jobs/search/types';

/** Raw job shape returned by job-management `formatJob()`. */
export type ApiJob = {
  id: string;
  title: string;
  companyName: string;
  companyLogoUri?: string;
  companyFallback?: LogoFallbackData;
  isVerified?: boolean;
  location: string;
  postedAt: string;
  endsAt?: string;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  salaryPeriod?: string;
  type: JobType;
  mode: JobMode;
  matchScore?: number;
  applicationStatus?: ApplicationStatus;
  applicants?: number;
  description?: string[];
  requirements?: string[];
  benefits?: string[];
  skills?: string[];
  perks?: string[];
  jobLevel?: string;
  education?: string;
  experience?: string;
  about?: string;
  contact?: JobContact;
  status?: string;
  postedBy?: string;
  riskCheck?: {
    prediction?: string;
  };
};

export type ListJobsParams = {
  q?: string;
  mode?: JobMode;
  type?: JobType;
  types?: JobType[];
  location?: string;
  currency?: string;
  salaryMin?: number;
  salaryMax?: number;
  sort?: SortOption;
  page?: number;
  limit?: number;
};

export type ListJobsResponse = {
  success: boolean;
  message: string;
  jobs: ApiJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type GetJobResponse = {
  success: boolean;
  message: string;
  job: ApiJob;
};

function buildJobsQuery(params: ListJobsParams = {}): string {
  const search = new URLSearchParams();

  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.mode) search.set('mode', params.mode);
  if (params.types?.length) search.set('types', params.types.join(','));
  else if (params.type) search.set('type', params.type);
  if (params.location?.trim()) search.set('location', params.location.trim());
  if (params.currency?.trim()) search.set('currency', params.currency.trim());
  if (params.salaryMin !== undefined) search.set('salaryMin', String(params.salaryMin));
  if (params.salaryMax !== undefined) search.set('salaryMax', String(params.salaryMax));
  if (params.sort) search.set('sort', params.sort);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.limit !== undefined) search.set('limit', String(params.limit));

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listJobs(
  params: ListJobsParams = {},
  token?: string | null
): Promise<ListJobsResponse> {
  const query = buildJobsQuery(params);
  const headers: HeadersInit = token ? authHeaders(token) : {};

  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs${query}`, {
    headers,
  });

  if (!response.ok) {
    await parseError(response, 'Failed to fetch jobs');
  }

  return response.json();
}

export async function getJobById(
  jobId: string,
  token?: string | null
): Promise<GetJobResponse> {
  const headers: HeadersInit = token ? authHeaders(token) : {};

  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/${jobId}`, {
    headers,
  });

  if (!response.ok) {
    await parseError(response, 'Failed to fetch job');
  }

  return response.json();
}

export type SavedJobsResponse = {
  success: boolean;
  message: string;
  jobs: ApiJob[];
  savedJobIds: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type SaveJobResponse = {
  success: boolean;
  message: string;
  jobId: string;
};

export async function getSavedJobs(
  token: string,
  params: { page?: number; limit?: number } = {}
): Promise<SavedJobsResponse> {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  const query = search.toString();

  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/saved${query ? `?${query}` : ''}`,
    {
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to fetch saved jobs');
  }

  return response.json();
}

export async function saveJob(
  token: string,
  jobId: string
): Promise<SaveJobResponse> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/saved`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId }),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to save job');
  }

  return response.json();
}

export async function unsaveJob(
  token: string,
  jobId: string
): Promise<SaveJobResponse> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/saved/${jobId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to remove saved job');
  }

  return response.json();
}

/** Raw application shape returned by job-management `formatApplication()`. */
export type ApiApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  companyLogoUri?: string;
  companyFallback?: LogoFallbackData;
  fullName?: string;
  email?: string;
  resumeUrl?: string;
  resumeName?: string;
  resumeDownloadUrl?: string;
  motivation?: string;
  appliedAt: string;
};

export type AppliedJobsResponse = {
  success: boolean;
  message: string;
  jobs: ApiJob[];
  applications: ApiApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getAppliedJobs(
  token: string,
  params: { page?: number; limit?: number } = {}
): Promise<AppliedJobsResponse> {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  const query = search.toString();

  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/applied${query ? `?${query}` : ''}`,
    {
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to fetch applied jobs');
  }

  return response.json();
}

/** Authenticated download URL — use with Bearer token (recruiter/applicant). */
export function getApplicationResumeDownloadEndpoint(applicationId: string): string {
  return `${getJobManagementBaseUrl()}/api/jobs/applications/${applicationId}/resume`;
}

export type ApplicationDetail = {
  id: string;
  applicantId: string;
  recruiterId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  companyLogo: string | null;
  status: string;
  applicantName: string;
  applicantEmail: string;
};

type ApplicationDetailResponse = {
  success: boolean;
  application: ApplicationDetail;
};

export async function getApplicationById(
  token: string,
  applicationId: string
): Promise<ApplicationDetail> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/applications/${applicationId}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to fetch application');
  }

  const data = (await response.json()) as ApplicationDetailResponse;
  return data.application;
}

export interface CreateJobRequest {
  title: string;
  companyName: string;
  location: string;
  jobType: string;
  jobMode: string;
  salaryMin?: string;
  salaryMax?: string;
  currency?: string;
  salaryPeriod?: string;
  description: string;
  requirements?: string;
  skills?: string;
  jobLevel?: string;
  education?: string;
  experience?: string;
  benefitsLines?: string;
  perksLines?: string;
  about?: string;
  email?: string;
  phone?: string;
  website?: string;
  closingDate?: string;
  logoUri?: string | null;
}

export interface CreateJobResponse {
  success: boolean;
  message: string;
  job: ApiJob;
}

async function parseError(response: Response, fallback: string): Promise<never> {
  try {
    const error = await response.json();
    throw new Error(error.message || fallback);
  } catch (err) {
    if (err instanceof Error && err.message !== fallback) throw err;
    throw new Error(fallback);
  }
}

function buildCreateJobFormData(payload: CreateJobRequest): FormData {
  const form = new FormData();

  appendFormField(form, 'title', payload.title);
  appendFormField(form, 'companyName', payload.companyName);
  appendFormField(form, 'location', payload.location);
  appendFormField(form, 'jobType', payload.jobType);
  appendFormField(form, 'jobMode', payload.jobMode);
  appendFormField(form, 'salaryMin', payload.salaryMin);
  appendFormField(form, 'salaryMax', payload.salaryMax);
  appendFormField(form, 'currency', payload.currency);
  appendFormField(form, 'salaryPeriod', payload.salaryPeriod);
  appendFormField(form, 'description', payload.description);
  appendFormField(form, 'requirements', payload.requirements);
  appendFormField(form, 'skills', payload.skills);
  appendFormField(form, 'jobLevel', payload.jobLevel);
  appendFormField(form, 'education', payload.education);
  appendFormField(form, 'experience', payload.experience);
  appendFormField(form, 'benefitsLines', payload.benefitsLines);
  appendFormField(form, 'perksLines', payload.perksLines);
  appendFormField(form, 'about', payload.about);
  appendFormField(form, 'email', payload.email);
  appendFormField(form, 'phone', payload.phone);
  appendFormField(form, 'website', payload.website);
  appendFormField(form, 'closingDate', payload.closingDate);

  if (payload.logoUri) {
    appendImageField(form, 'logo', payload.logoUri);
  }

  return form;
}

export async function createJob(
  token: string,
  payload: CreateJobRequest
): Promise<CreateJobResponse> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildCreateJobFormData(payload),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to post job');
  }

  return response.json();
}

export interface ApplyToJobRequest {
  fullName: string;
  email: string;
  motivation?: string;
  resumeUri: string;
  resumeName: string;
  resumeMimeType?: string;
}

export interface ApplyToJobResponse {
  success: boolean;
  message: string;
  application: {
    id: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
    status: string;
    resumeUrl?: string;
    resumeName?: string;
    appliedAt: string;
  };
}

function buildApplyFormData(payload: ApplyToJobRequest): FormData {
  const form = new FormData();

  appendFormField(form, 'fullName', payload.fullName);
  appendFormField(form, 'email', payload.email);
  appendFormField(form, 'motivation', payload.motivation);
  appendFormField(form, 'resumeName', payload.resumeName);
  appendDocumentField(
    form,
    'resume',
    payload.resumeUri,
    payload.resumeName,
    payload.resumeMimeType || 'application/pdf'
  );

  return form;
}

export async function applyToJob(
  token: string,
  jobId: string,
  payload: ApplyToJobRequest
): Promise<ApplyToJobResponse> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/${jobId}/apply`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildApplyFormData(payload),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to submit application');
  }

  return response.json();
}

export type RecruiterJobsParams = {
  status?: 'active' | 'closed' | 'draft';
  page?: number;
  limit?: number;
  sort?: SortOption;
};

export async function getJobsByRecruiter(
  recruiterId: string,
  params: RecruiterJobsParams = {},
  token?: string | null
): Promise<ListJobsResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.sort) search.set('sort', params.sort);

  const query = search.toString();
  const headers: HeadersInit = token ? authHeaders(token) : {};

  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/recruiter/${encodeURIComponent(recruiterId)}${query ? `?${query}` : ''}`,
    { headers }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to fetch recruiter jobs');
  }

  return response.json();
}
