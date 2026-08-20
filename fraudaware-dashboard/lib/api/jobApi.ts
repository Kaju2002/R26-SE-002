import {
  authHeaders,
  authHeadersMultipart,
  getJobManagementBaseUrl,
} from './apiConfig';

export type JobStatus = 'active' | 'draft' | 'closed';

export type EmployerWorkspaceRole = 'owner' | 'admin' | 'recruiter' | 'viewer';

export type EmployerWorkspace = {
  id: string;
  ownerId?: string;
  name: string;
  normalizedName?: string;
  logo: string | null;
  status: 'active' | 'inactive' | string;
  role?: EmployerWorkspaceRole;
  members?: Array<{
    userId: string;
    role: EmployerWorkspaceRole;
    status: 'active' | 'inactive' | string;
  }>;
};

export type JobSummary = {
  id: string;
  workspaceId: string | null;
  title: string;
  companyName: string;
  status: JobStatus | string;
  applicants: number;
  location?: string;
  type?: string;
  mode?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  posterType?: 'recruiter' | 'company';
  posterImage?: string;
  companyLogoUri?: string;
  description?: string[];
  requirements?: string[];
  skills?: string[];
  postedAt?: string;
  endsAt?: string;
  about?: string;
  jobLevel?: string;
  education?: string;
  experience?: string;
  benefits?: string[];
  perks?: string[];
};

export type JobDetail = JobSummary & {
  postedBy?: string;
  isVerified?: boolean;
  contact?: {
    location?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
};

export type JobApplication = {
  id: string;
  workspaceId: string | null;
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
  workspaceId: string | null;
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
  workspaceId?: string;
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
  benefits?: string;
  about?: string;
  jobLevel?: string;
  education?: string;
  experience?: string;
  status?: JobStatus;
  posterImage?: string;
};

export type ListMyJobsParams = {
  page?: number;
  limit?: number;
  status?: JobStatus | 'all';
  q?: string;
  sort?: string;
  workspaceId?: string;
};

export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type MyJobsResponse = {
  success: boolean;
  jobs: JobSummary[];
  pagination?: PaginationInfo;
};

type JobResponse = {
  success: boolean;
  job: JobDetail;
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

type WorkspacesResponse = {
  success?: boolean;
  workspaces: EmployerWorkspace[];
};

type WorkspaceResponse = {
  success?: boolean;
  workspace: EmployerWorkspace;
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

function appendPayloadFields(formData: FormData, payload: Partial<CreateJobPayload>) {
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, String(value));
  });
}

export async function listMyJobs(
  token: string,
  params: ListMyJobsParams = {}
): Promise<{ jobs: JobSummary[]; pagination: PaginationInfo }> {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 10));
  if (params.status && params.status !== 'all') {
    search.set('status', params.status);
  }
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.sort) search.set('sort', params.sort);

  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/mine?${search.toString()}`,
    {
      method: 'GET',
      headers: {
        ...authHeaders(token),
        ...(params.workspaceId ? { 'X-Workspace-Id': params.workspaceId } : {}),
      },
      cache: 'no-store',
    }
  );

  const data = await parseJson<MyJobsResponse>(response);
  return {
    jobs: data.jobs,
    pagination: data.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      total: data.jobs.length,
      totalPages: 1,
    },
  };
}

export async function listEmployerWorkspaces(token: string): Promise<EmployerWorkspace[]> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/workspaces`, {
    method: 'GET',
    headers: authHeaders(token),
    cache: 'no-store',
  });

  return (await parseJson<WorkspacesResponse>(response)).workspaces;
}

export async function getEmployerWorkspace(
  token: string,
  workspaceId: string
): Promise<EmployerWorkspace> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/workspaces/${encodeURIComponent(workspaceId)}`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  return (await parseJson<WorkspaceResponse>(response)).workspace;
}

export async function getJobById(token: string, jobId: string): Promise<JobDetail> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/${jobId}`, {
    method: 'GET',
    headers: authHeaders(token),
    cache: 'no-store',
  });

  return (await parseJson<JobResponse>(response)).job;
}

export async function createJob(
  token: string,
  payload: CreateJobPayload,
  logoFile?: File | null
): Promise<JobDetail> {
  if (logoFile) {
    const formData = new FormData();
    appendPayloadFields(formData, payload);
    formData.append('logo', logoFile);
    const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs`, {
      method: 'POST',
      headers: authHeadersMultipart(token),
      body: formData,
    });
    return (await parseJson<JobResponse>(response)).job;
  }

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
  payload: Partial<CreateJobPayload>,
  logoFile?: File | null
): Promise<JobDetail> {
  if (logoFile) {
    const formData = new FormData();
    appendPayloadFields(formData, payload);
    formData.append('logo', logoFile);
    const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: authHeadersMultipart(token),
      body: formData,
    });
    return (await parseJson<JobResponse>(response)).job;
  }

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
  applicationId: string,
  workspaceId?: string
): Promise<ApplicationDetail> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/applications/${applicationId}`,
    {
      method: 'GET',
      headers: {
        ...authHeaders(token),
        ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
      },
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

export function descriptionToText(value?: string[] | string | null): string {
  if (!value) return '';
  if (Array.isArray(value)) return value.join('\n');
  return value;
}

export function listToMultiline(value?: string[] | null): string {
  if (!value?.length) return '';
  return value.join('\n');
}

export function skillsToCsv(value?: string[] | null): string {
  if (!value?.length) return '';
  return value.join(', ');
}
