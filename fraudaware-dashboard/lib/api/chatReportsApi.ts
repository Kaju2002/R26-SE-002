import { authHeaders, getChatManagementBaseUrl } from '@/lib/api/apiConfig';

export type ChatReportListItem = {
  id: string;
  conversationId: string;
  applicationId: string;
  jobId: string;
  recruiterId: string;
  jobseekerId: string;
  workspaceName: string;
  peerLabel: string;
  jobLabel: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reasonCode: string;
  details: string;
  tacticsSummary: string[];
  flaggedCount: number;
  maxScore: number | null;
  riskLevel: 'caution' | 'high';
  status: 'new' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string | null;
  adminNote?: string | null;
  feedback: 'none' | 'helpful' | 'false_alarm';
  feedbackAt?: string | null;
};

export type ChatReportDetail = ChatReportListItem & {
  evidenceMessages: Array<{
    messageId: string;
    senderId: string;
    role: string;
    messageType: string;
    body: string;
    createdAt: string | null;
    scamAnalysis: {
      status: string;
      isScam: boolean;
      score: number | null;
      tactics: string[];
      analyzedAt: string | null;
    };
  }>;
  timeline: Array<{
    at: string | null;
    label: string;
    riskLevel: string;
    messageId: string | null;
    tactics: string[];
    score: number | null;
  }>;
};

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function listChatReports(
  token: string,
  opts?: { status?: string; limit?: number }
): Promise<ChatReportListItem[]> {
  const params = new URLSearchParams();
  if (opts?.status && opts.status !== 'all') params.set('status', opts.status);
  params.set('limit', String(opts?.limit ?? 50));
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/reports?${params.toString()}`,
    { headers: authHeaders(token) }
  );
  const data = await parseJson(response);
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Could not load chat reports');
  }
  return (data.reports || []) as ChatReportListItem[];
}

export async function getChatReportDetail(
  token: string,
  reportId: string
): Promise<ChatReportDetail> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/reports/${encodeURIComponent(reportId)}`,
    { headers: authHeaders(token) }
  );
  const data = await parseJson(response);
  if (!response.ok || !data.success || !data.report) {
    throw new Error(data.message || 'Could not load chat report');
  }
  return data.report as ChatReportDetail;
}

export async function updateChatReportStatus(
  token: string,
  reportId: string,
  payload: { status: string; adminNote?: string }
): Promise<ChatReportDetail> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/reports/${encodeURIComponent(reportId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );
  const data = await parseJson(response);
  if (!response.ok || !data.success || !data.report) {
    throw new Error(data.message || 'Could not update chat report');
  }
  return data.report as ChatReportDetail;
}
