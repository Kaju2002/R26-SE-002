export function getUserManagementBaseUrl(): string {
  return (
    (process.env.EXPO_PUBLIC_USER_MANAGEMENT_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:5000'
  );
}

export function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}
