import { authHeaders, getChatManagementBaseUrl } from './apiConfig';
import type { ReportReasonCode } from './reportApi';
import { REPORT_REASON_OPTIONS } from './reportApi';

export type ChatReportFeedback = 'none' | 'helpful' | 'false_alarm';

export type ChatReportTimelinePoint = {
  at: string | null;
  label: string;
  riskLevel: 'safe' | 'caution' | 'high';
  messageId: string | null;
  tactics: string[];
  score: number | null;
};

export type ChatReportEvidenceMessage = {
  messageId: string;
  senderId: string;
  role: 'recruiter' | 'jobseeker' | 'unknown';
  messageType: 'text' | 'image' | 'file' | 'audio' | 'system';
  body: string;
  createdAt: string | null;
  scamAnalysis: {
    status: string;
    isScam: boolean;
    score: number | null;
    tactics: string[];
    analyzedAt: string | null;
  };
};

export type ChatReport = {
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
  reporterRole: 'jobseeker' | 'recruiter';
  reasonCode: ReportReasonCode;
  details: string;
  tacticsSummary: string[];
  flaggedCount: number;
  maxScore: number | null;
  riskLevel: 'caution' | 'high';
  status: 'new' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string | null;
  adminNote?: string | null;
  feedback: ChatReportFeedback;
  feedbackAt?: string | null;
  evidenceMessages?: ChatReportEvidenceMessage[];
  timeline?: ChatReportTimelinePoint[];
};

export { REPORT_REASON_OPTIONS };

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function createConversationReport(
  token: string,
  conversationId: string,
  payload: {
    reasonCode: ReportReasonCode;
    details?: string;
    peerLabel?: string;
    jobLabel?: string;
    reporterName?: string;
  }
): Promise<ChatReport> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${encodeURIComponent(conversationId)}/reports`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    }
  );
  const data = await parseJson(response);
  if (!response.ok || !data.success || !data.report) {
    throw new Error(data.message || 'Could not submit chat report');
  }
  return data.report as ChatReport;
}

export async function getMyConversationReport(
  token: string,
  conversationId: string
): Promise<ChatReport | null> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${encodeURIComponent(conversationId)}/reports/me`,
    { headers: authHeaders(token) }
  );
  const data = await parseJson(response);
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Could not load chat report');
  }
  return (data.report as ChatReport | null) ?? null;
}

export async function submitChatReportFeedback(
  token: string,
  reportId: string,
  feedback: 'helpful' | 'false_alarm'
): Promise<ChatReport> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/reports/${encodeURIComponent(reportId)}/feedback`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ feedback }),
    }
  );
  const data = await parseJson(response);
  if (!response.ok || !data.success || !data.report) {
    throw new Error(data.message || 'Could not save feedback');
  }
  return data.report as ChatReport;
}
