import { authHeaders, getJobManagementBaseUrl } from './apiConfig';
import type { Job } from '../../data/jobs';
import { appendDocumentField, appendFormField, appendImageField } from '../utils/formDataHelpers';

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
  job: Job & {
    status?: string;
    postedBy?: string;
  };
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
