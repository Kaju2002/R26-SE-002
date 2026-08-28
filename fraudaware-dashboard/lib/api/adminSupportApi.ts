import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@/lib/admin/supportTypes';

export type SupportTicketCounts = {
  total: number;
  open: number;
  in_progress: number;
  closed: number;
};

export type ListSupportTicketsParams = {
  status?: SupportTicketStatus | 'all';
  q?: string;
  page?: number;
  limit?: number;
};

export type ListSupportTicketsResult = {
  items: SupportTicket[];
  counts: SupportTicketCounts;
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
  items: SupportTicket[];
  counts: SupportTicketCounts;
  pagination: ListSupportTicketsResult['pagination'];
};

type ItemResponse = {
  success: boolean;
  message: string;
  item: SupportTicket;
};

const EMPTY_COUNTS: SupportTicketCounts = {
  total: 0,
  open: 0,
  in_progress: 0,
  closed: 0,
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

export async function listSupportTickets(
  token: string,
  params: ListSupportTicketsParams = {}
): Promise<ListSupportTicketsResult> {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') {
    search.set('status', params.status);
  }
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/support-tickets${query ? `?${query}` : ''}`,
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

export async function getSupportTicket(
  token: string,
  ticketId: string
): Promise<SupportTicket> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/support-tickets/${encodeURIComponent(ticketId)}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  const data = await parseJson<ItemResponse>(response);
  return data.item;
}

export async function updateSupportTicket(
  token: string,
  ticketId: string,
  patch: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    internalNote?: string | null;
  }
): Promise<SupportTicket> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/support-tickets/${encodeURIComponent(ticketId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    }
  );

  const data = await parseJson<ItemResponse>(response);
  return data.item;
}

export async function assignSupportTicketToMe(
  token: string,
  ticketId: string
): Promise<SupportTicket> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/support-tickets/${encodeURIComponent(ticketId)}/assign-me`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );

  const data = await parseJson<ItemResponse>(response);
  return data.item;
}

export async function addSupportTicketMessage(
  token: string,
  ticketId: string,
  body: string
): Promise<SupportTicket> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/admin/support-tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ body }),
    }
  );

  const data = await parseJson<ItemResponse>(response);
  return data.item;
}
