import { authHeaders, getJobManagementBaseUrl } from './apiConfig';

export type ReportReasonCode =
  | 'fake_job'
  | 'payment_request'
  | 'harassment'
  | 'spam'
  | 'impersonation'
  | 'other';

export type JobReport = {
  id: string;
  targetType: 'job';
  targetId: string;
  targetLabel: string;
  reporterId?: string;
  reporterName: string;
  reporterEmail: string;
  reasonCode: ReportReasonCode;
  details: string;
  status: 'new' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string | null;
  adminNote?: string | null;
};

export const REPORT_REASON_OPTIONS: {
  code: ReportReasonCode;
  label: string;
}[] = [
  { code: 'fake_job', label: 'Fake / misleading job' },
  { code: 'payment_request', label: 'Asking for money / fees' },
  { code: 'spam', label: 'Spam' },
  { code: 'impersonation', label: 'Impersonation' },
  { code: 'harassment', label: 'Harassment' },
  { code: 'other', label: 'Other' },
];

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function createJobReport(
  token: string,
  jobId: string,
  payload: { reasonCode: ReportReasonCode; details?: string }
): Promise<{ success: boolean; message: string; report?: JobReport }> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/${encodeURIComponent(jobId)}/report`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reasonCode: payload.reasonCode,
        details: payload.details ?? '',
      }),
    }
  );

  const data = await parseJson(response);

  if (!response.ok) {
    const err = new Error(
      data.message || 'Could not submit report'
    ) as Error & { status?: number; report?: JobReport };
    err.status = response.status;
    if (data.report) err.report = data.report;
    throw err;
  }

  return data;
}

export async function getMyJobReport(
  token: string,
  jobId: string
): Promise<JobReport | null> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/${encodeURIComponent(jobId)}/report/me`,
    {
      method: 'GET',
      headers: {
        ...authHeaders(token),
      },
    }
  );

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.message || 'Could not load report status');
  }

  return data.report ?? null;
}
