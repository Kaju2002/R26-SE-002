import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  CompanyVerificationRequest,
  VerificationDecision,
} from '@/lib/admin/verificationTypes';

export type VerificationCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type ListVerificationRequestsParams = {
  q?: string;
  decision?: VerificationDecision | 'all';
  page?: number;
  limit?: number;
};

export type ListVerificationRequestsResult = {
  items: CompanyVerificationRequest[];
  counts: VerificationCounts;
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
  items: CompanyVerificationRequest[];
  counts: VerificationCounts;
  pagination: ListVerificationRequestsResult['pagination'];
};

type DecisionResponse = {
  success: boolean;
  message: string;
  item: CompanyVerificationRequest;
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

export async function listVerificationRequests(
  token: string,
  params: ListVerificationRequestsParams = {}
): Promise<ListVerificationRequestsResult> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.decision && params.decision !== 'all') {
    search.set('decision', params.decision);
  }
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/verification-requests${
      query ? `?${query}` : ''
    }`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  const data = await parseJson<ListResponse>(response);
  return {
    items: data.items || [],
    counts: data.counts || {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    },
    pagination: data.pagination || {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function decideVerificationRequest(
  token: string,
  id: string,
  decision: Extract<VerificationDecision, 'approved' | 'rejected'>,
  rejectionReason?: string
): Promise<CompanyVerificationRequest> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/verification-requests/${encodeURIComponent(
      id
    )}/decision`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({
        decision,
        rejectionReason: rejectionReason || undefined,
      }),
    }
  );

  const data = await parseJson<DecisionResponse>(response);
  return data.item;
}
