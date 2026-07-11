export function getUserManagementBaseUrl(): string {
  return (
    (process.env.EXPO_PUBLIC_USER_MANAGEMENT_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:5000'
  );
}

/**
 * Set `EXPO_PUBLIC_JOB_MANAGEMENT_API_BASE_URL` in `FraudAware/.env`
 * (e.g. `http://192.168.1.250:5001`, no trailing slash). Restart Expo after changing.
 */
export function getJobManagementBaseUrl(): string {
  return (
    (process.env.EXPO_PUBLIC_JOB_MANAGEMENT_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:5001'
  );
}

export function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}
