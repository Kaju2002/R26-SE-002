import { authHeaders, getJobManagementBaseUrl } from './apiConfig';

export type AnalyticsRangeKey = '7d' | '30d' | 'all';

export type AnalyticsFunnel = {
  applied: number;
  screened: number;
  shortlisted: number;
  interview: number;
  offered: number;
  hired: number;
  rejected: number;
};

export type AnalyticsKpis = {
  activeJobs: number;
  totalJobs: number;
  applicants: number;
  applicantsDelta: number;
  needsAction: number;
  interviewsThisWeek: number;
  hired: number;
  rejected: number;
  avgQueueDays: number | null;
  conversionToInterview: number;
  conversionToHire: number;
};

export type AnalyticsJobRow = {
  jobId: string;
  title: string;
  status: string;
  applicants: number;
  reachedInterview: number;
  hired: number;
  rejected: number;
  conversionPct: number;
  hirePct: number;
  openDays: number;
};

export type EmployerAnalytics = {
  range: { key: AnalyticsRangeKey; from: string | null; to: string };
  kpis: AnalyticsKpis;
  funnel: AnalyticsFunnel;
  byJob: AnalyticsJobRow[];
  series: { days: string[]; applicants: number[] };
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

export async function getEmployerAnalytics(
  token: string,
  params: { range?: AnalyticsRangeKey; workspaceId?: string } = {}
): Promise<EmployerAnalytics> {
  const search = new URLSearchParams();
  if (params.range) search.set('range', params.range);
  if (params.workspaceId) search.set('workspaceId', params.workspaceId);
  const query = search.toString();

  const headers: HeadersInit = { ...authHeaders(token) };
  if (params.workspaceId) {
    (headers as Record<string, string>)['X-Workspace-Id'] = params.workspaceId;
  }

  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/analytics${query ? `?${query}` : ''}`,
    { headers }
  );
  const data = await parseJson<EmployerAnalytics & { success: boolean }>(response);
  return data;
}
