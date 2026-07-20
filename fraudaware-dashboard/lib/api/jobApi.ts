import { authHeaders, getJobManagementBaseUrl } from './apiConfig';

export type JobSummary = {
  id: string;
  title: string;
  companyName: string;
  status: string;
  applicants: number;
  location?: string;
  type?: string;
  mode?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  posterType?: 'recruiter' | 'company';
  description?: string[];
};

export type JobApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  status: string;
  motivation?: string;
  appliedAt: string;
};

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

export type CreateJobPayload = {
  title: string;
  companyName?: string;
  location: string;
  mode: 'On-Site' | 'Remote' | 'Hybrid';
  type: 'Full-Time' | 'Part-Time' | 'Contract' | 'Internship';
  salaryMin: number;
  salaryMax: number;
  salaryCurrency?: string;
  description: string;
  requirements?: string;
  skills?: string;
  status?: 'active' | 'draft' | 'closed';
};

type MyJobsResponse = {
  success: boolean;
  jobs: JobSummary[];
};

type JobResponse = {
  success: boolean;
  job: JobSummary;
  message?: string;
};

type JobApplicationsResponse = {
  success: boolean;
  applications: JobApplication[];
};

type ApplicationDetailResponse = {
  success: boolean;
  application: ApplicationDetail;
};

async function parseJson<T>(response: Response): Promise<T> {
  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      typeof data.message === 'string' ? data.message : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export async function listMyJobs(token: string): Promise<JobSummary[]> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/mine?limit=50`, {
    method: 'GET',
    headers: authHeaders(token),
    cache: 'no-store',
  });

  return (await parseJson<MyJobsResponse>(response)).jobs;
}

export async function createJob(
  token: string,
  payload: CreateJobPayload
): Promise<JobSummary> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  return (await parseJson<JobResponse>(response)).job;
}

export async function updateJob(
  token: string,
  jobId: string,
  payload: Partial<CreateJobPayload>
): Promise<JobSummary> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/${jobId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  return (await parseJson<JobResponse>(response)).job;
}

export async function deleteJob(token: string, jobId: string): Promise<void> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/${jobId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  await parseJson<{ success: boolean }>(response);
}

export async function listJobApplications(
  token: string,
  jobId: string
): Promise<JobApplication[]> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/${jobId}/applications?limit=50`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  return (await parseJson<JobApplicationsResponse>(response)).applications;
}

export async function getApplicationById(
  token: string,
  applicationId: string
): Promise<ApplicationDetail> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/applications/${applicationId}`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  return (await parseJson<ApplicationDetailResponse>(response)).application;
}

export async function updateApplicationStatus(
  token: string,
  applicationId: string,
  status: string
): Promise<void> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/applications/${applicationId}/status`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status }),
    }
  );

  await parseJson<{ success: boolean }>(response);
}
