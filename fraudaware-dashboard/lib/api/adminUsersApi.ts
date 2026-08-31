import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  ManagedAccountStatus,
  ManagedAccountType,
  ManagedUser,
} from '@/lib/admin/types';

export type ManagedUserCounts = {
  total: number;
  jobseeker: number;
  recruiter: number;
  company: number;
  active: number;
  suspended: number;
  banned: number;
};

export type ListManagedUsersParams = {
  q?: string;
  /** `company` includes legacy `recruiter` accounts (employer filter). */
  accountType?: 'jobseeker' | 'company' | 'all';
  accountStatus?: ManagedAccountStatus | 'all';
  page?: number;
  limit?: number;
};

export type ListManagedUsersResult = {
  items: ManagedUser[];
  counts: ManagedUserCounts;
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
  items: ManagedUser[];
  counts: ManagedUserCounts;
  pagination: ListManagedUsersResult['pagination'];
};

type StatusResponse = {
  success: boolean;
  message: string;
  item: ManagedUser;
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

export async function listManagedUsers(
  token: string,
  params: ListManagedUsersParams = {}
): Promise<ListManagedUsersResult> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.accountType && params.accountType !== 'all') {
    search.set('accountType', params.accountType);
  }
  if (params.accountStatus && params.accountStatus !== 'all') {
    search.set('accountStatus', params.accountStatus);
  }
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/users${query ? `?${query}` : ''}`,
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
      jobseeker: 0,
      recruiter: 0,
      company: 0,
      active: 0,
      suspended: 0,
      banned: 0,
    },
    pagination: data.pagination || {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function updateManagedUserStatus(
  token: string,
  userId: string,
  accountStatus: ManagedAccountStatus,
  reason?: string
): Promise<ManagedUser> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/users/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({
        accountStatus,
        reason: reason || undefined,
      }),
    }
  );

  const data = await parseJson<StatusResponse>(response);
  return data.item;
}
