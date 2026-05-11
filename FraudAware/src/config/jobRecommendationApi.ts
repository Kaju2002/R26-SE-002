/**
 * Set `EXPO_PUBLIC_JOB_REC_API_BASE_URL` in `FraudAware/.env`
 * (e.g. `http://192.168.1.250:8002`, no trailing slash). Restart Expo after changing.
 */
export function getJobRecApiBase(): string {
  return (
    (process.env.EXPO_PUBLIC_JOB_REC_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:8002'
  );
}

export function getJobRecommendUrl(): string {
  return `${getJobRecApiBase()}/recommend`;
}
