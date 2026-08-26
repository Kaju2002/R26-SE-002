export type ReportTargetType = 'job' | 'user' | 'company' | 'message';

export type ReportReasonCode =
  | 'fake_job'
  | 'payment_request'
  | 'harassment'
  | 'spam'
  | 'impersonation'
  | 'other';

export type ReportStatus = 'new' | 'reviewing' | 'resolved' | 'dismissed';

export type PlatformReport = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  reporterName: string;
  reporterEmail: string;
  reasonCode: ReportReasonCode;
  details: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string | null;
  adminNote?: string | null;
};
