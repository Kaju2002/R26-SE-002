import { authHeaders, getJobManagementBaseUrl } from './apiConfig';

export type JobSummary = {
  id: string;
  title: string;
  companyName: string;
  status: string;
  applicants: number;
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

type MyJobsResponse = {
  success: boolean;
  jobs: JobSummary[];
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
