import { authHeaders, getJobManagementBaseUrl } from './apiConfig';

export type InterviewType = 'video' | 'phone' | 'onsite';
export type InterviewStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

/** Statuses that block scheduling another interview for the same application. */
export const ACTIVE_INTERVIEW_STATUSES: InterviewStatus[] = [
  'scheduled',
  'rescheduled',
];

export function isActiveInterviewStatus(status: InterviewStatus): boolean {
  return ACTIVE_INTERVIEW_STATUSES.includes(status);
}

/** True when an interview should prevent scheduling another for the same application. */
export function isBlockingInterview(
  interview: Pick<Interview, 'status' | 'endsAt'>,
  now = Date.now()
): boolean {
  if (!isActiveInterviewStatus(interview.status)) return false;
  const endsAt = new Date(interview.endsAt).getTime();
  return Number.isFinite(endsAt) && endsAt > now;
}

export type Interview = {
  id: string;
  workspaceId: string | null;
  jobId: string;
  applicationId: string;
  candidateUserId: string;
  organizerId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  type: InterviewType;
  location: string;
  notes: string;
  status: InterviewStatus;
  conferenceProvider: string | null;
  conferenceUrl: string | null;
  calendarEventId: string | null;
  calendarId: string;
  calendarHtmlLink: string | null;
  inviteEmailSent: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreateInterviewPayload = {
  applicationId: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  type?: InterviewType;
  location?: string;
  notes?: string;
  conferenceUrl?: string;
  conferencingProvider?: 'google_meet' | 'microsoft_teams' | 'none';
  addConferencing?: boolean;
  sendInvite?: boolean;
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
    const error = new Error(message) as Error & { code?: string };
    if (typeof data.code === 'string') error.code = data.code;
    throw error;
  }
  return data as T;
}

export async function listInterviews(
  token: string,
  params: { status?: string; from?: string; to?: string; limit?: number } = {}
): Promise<Interview[]> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.limit) search.set('limit', String(params.limit));

  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/interviews?${search.toString()}`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  const data = await parseJson<{ interviews: Interview[] }>(response);
  return data.interviews;
}

export async function createInterview(
  token: string,
  payload: CreateInterviewPayload
): Promise<{ interview: Interview; warnings: string[] }> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/interviews`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{
    interview: Interview;
    warnings?: string[];
  }>(response);

  return {
    interview: data.interview,
    warnings: data.warnings || [],
  };
}

export async function cancelInterview(
  token: string,
  interviewId: string,
  options?: { revertToShortlisted?: boolean }
): Promise<Interview> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/interviews/${encodeURIComponent(interviewId)}/cancel`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        revertToShortlisted: options?.revertToShortlisted !== false,
      }),
    }
  );

  const data = await parseJson<{ interview: Interview }>(response);
  return data.interview;
}

export async function updateInterviewStatus(
  token: string,
  interviewId: string,
  status: InterviewStatus,
  notes?: string
): Promise<Interview> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/interviews/${encodeURIComponent(interviewId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status, notes }),
    }
  );

  const data = await parseJson<{ interview: Interview }>(response);
  return data.interview;
}

export async function rescheduleInterview(
  token: string,
  interviewId: string,
  payload: { startsAt: string; endsAt: string; timezone?: string }
): Promise<{ interview: Interview; warnings: string[] }> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/interviews/${encodeURIComponent(interviewId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );

  const data = await parseJson<{ interview: Interview; warnings?: string[] }>(response);
  return {
    interview: data.interview,
    warnings: data.warnings || [],
  };
}
