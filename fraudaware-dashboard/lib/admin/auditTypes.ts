export type AuditTargetType = 'user' | 'company' | 'job' | 'report';

export type AuditAction =
  | 'user.suspend'
  | 'user.ban'
  | 'user.restore'
  | 'company.verify.approve'
  | 'company.verify.reject'
  | 'job.clear'
  | 'job.force_close'
  | 'report.resolve'
  | 'report.dismiss';

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
  summary: string;
  before: Record<string, string | number | boolean | null>;
  after: Record<string, string | number | boolean | null>;
  note?: string | null;
};
