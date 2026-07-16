import { authHeaders, getNotificationBaseUrl } from './apiConfig';

export async function registerPushToken(
  authToken: string,
  payload: { token: string; platform?: string; deviceName?: string }
): Promise<void> {
  const response = await fetch(
    `${getNotificationBaseUrl()}/api/notifications/push-token`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(authToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message?: string }).message)
        : 'Failed to register push token'
    );
  }
}

export async function unregisterPushToken(
  authToken: string,
  pushToken: string
): Promise<void> {
  const response = await fetch(
    `${getNotificationBaseUrl()}/api/notifications/push-token`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(authToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: pushToken }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message?: string }).message)
        : 'Failed to unregister push token'
    );
  }
}
