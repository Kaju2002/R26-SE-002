import { authHeaders, getNotificationBaseUrl } from './apiConfig';
import type { AppNotification } from '../../data/notifications';
import type { ApplicationStatus } from '../../data/applicationNotifications';
import type { LogoFallbackData } from '../types/profile';

export type ApiGeneralNotification = AppNotification;

export type ApiApplicationNotification = {
  id: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  companyLogoUri?: string;
  companyFallback?: LogoFallbackData;
  read?: boolean;
  createdAt?: string;
};

export type ApiNotification = ApiGeneralNotification | ApiApplicationNotification;

export type ListNotificationsResponse = {
  success: boolean;
  message: string;
  notifications: ApiNotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ListNotificationsParams = {
  category?: 'general' | 'applications';
  page?: number;
  limit?: number;
};

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message?: string }).message)
        : `Request failed (${response.status})`
    );
  }
  return data as T;
}

function buildQuery(params: ListNotificationsParams = {}): string {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listNotifications(
  token: string,
  params: ListNotificationsParams = {}
): Promise<ListNotificationsResponse> {
  const response = await fetch(
    `${getNotificationBaseUrl()}/api/notifications${buildQuery(params)}`,
    {
      method: 'GET',
      headers: {
        ...authHeaders(token),
      },
    }
  );

  return parseJson<ListNotificationsResponse>(response);
}

export async function deleteNotification(
  token: string,
  notificationId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${getNotificationBaseUrl()}/api/notifications/${notificationId}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
      },
    }
  );

  return parseJson(response);
}

export async function clearNotifications(
  token: string,
  category: 'general' | 'applications'
): Promise<{ success: boolean; message: string; deletedCount?: number }> {
  const response = await fetch(
    `${getNotificationBaseUrl()}/api/notifications?category=${category}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
      },
    }
  );

  return parseJson(response);
}
