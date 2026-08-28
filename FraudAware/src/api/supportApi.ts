import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type {
  CreateSupportTicketRequest,
  SupportTicket,
  SupportTicketStatus,
} from '../types/support';

type ItemResponse = {
  success: boolean;
  message: string;
  item: SupportTicket;
};

type ListResponse = {
  success: boolean;
  message: string;
  items: SupportTicket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ListMySupportTicketsParams = {
  status?: SupportTicketStatus;
  page?: number;
  limit?: number;
};

export type ListMySupportTicketsResult = {
  items: SupportTicket[];
  pagination: ListResponse['pagination'];
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

export async function createSupportTicket(
  token: string,
  payload: CreateSupportTicketRequest
): Promise<SupportTicket> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/support/tickets`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJson<ItemResponse>(response);
  return data.item;
}

export async function listMySupportTickets(
  token: string,
  params: ListMySupportTicketsParams = {}
): Promise<ListMySupportTicketsResult> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/support/tickets${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  const data = await parseJson<ListResponse>(response);
  return {
    items: data.items || [],
    pagination: data.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function getMySupportTicket(
  token: string,
  ticketId: string
): Promise<SupportTicket> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/support/tickets/${encodeURIComponent(ticketId)}`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  const data = await parseJson<ItemResponse>(response);
  return data.item;
}

export async function addMySupportTicketMessage(
  token: string,
  ticketId: string,
  body: string
): Promise<SupportTicket> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/support/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    }
  );

  const data = await parseJson<ItemResponse>(response);
  return data.item;
}
