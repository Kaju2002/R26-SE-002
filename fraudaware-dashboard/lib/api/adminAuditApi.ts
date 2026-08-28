import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  AuditAction,
  AuditLogEntry,
  AuditTargetType,
} from '@/lib/admin/auditTypes';

export type AuditLogCounts = {
  total: number;
  user: number;
  company: number;
  job: number;
  report: number;
  support: number;
};

export type ListAuditLogsParams = {
  action?: AuditAction;
  targetType?: AuditTargetType | 'all';
  q?: string;
  page?: number;
  limit?: number;
};

export type ListAuditLogsResult = {
  items: AuditLogEntry[];
  counts: AuditLogCounts;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ListResponse = {
  success: boolean;
  message: string;
  items: AuditLogEntry[];
  counts: AuditLogCounts;
  pagination: ListAuditLogsResult['pagination'];
};

const EMPTY_COUNTS: AuditLogCounts = {
  total: 0,
  user: 0,
  company: 0,
  job: 0,
  report: 0,
  support: 0,
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
      typeof data.message === 'string'
        ? data.message
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export async function listAuditLogs(
  token: string,
  params: ListAuditLogsParams = {}
): Promise<ListAuditLogsResult> {
  const search = new URLSearchParams();
  if (params.action) search.set('action', params.action);
  if (params.targetType && params.targetType !== 'all') {
    search.set('targetType', params.targetType);
  }
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/audit-log${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  const data = await parseJson<ListResponse>(response);
  return {
    items: data.items || [],
    counts: data.counts || EMPTY_COUNTS,
    pagination: data.pagination || {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    },
  };
}
