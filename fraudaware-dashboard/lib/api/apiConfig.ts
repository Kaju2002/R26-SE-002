/**
 * Set `NEXT_PUBLIC_USER_MANAGEMENT_API_BASE_URL` in `.env.local`
 * (e.g. `http://localhost:5005`, no trailing slash).
 */
export function getUserManagementBaseUrl(): string {
  return (
    (process.env.NEXT_PUBLIC_USER_MANAGEMENT_API_BASE_URL ?? '')
      .trim()
      .replace(/\/$/, '') || 'http://127.0.0.1:5005'
  );
}

export function getChatManagementBaseUrl(): string {
  return (
    (process.env.NEXT_PUBLIC_CHAT_MANAGEMENT_API_BASE_URL ?? '')
      .trim()
      .replace(/\/$/, '') || 'http://127.0.0.1:5003'
  );
}

export function getJobManagementBaseUrl(): string {
  return (
    (process.env.NEXT_PUBLIC_JOB_MANAGEMENT_API_BASE_URL ?? '')
      .trim()
      .replace(/\/$/, '') || 'http://127.0.0.1:5001'
  );
}

export function getEmailManagementBaseUrl(): string {
  return (
    (process.env.NEXT_PUBLIC_EMAIL_MANAGEMENT_API_BASE_URL ?? '')
      .trim()
      .replace(/\/$/, '') || 'http://127.0.0.1:5004'
  );
}

export function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
