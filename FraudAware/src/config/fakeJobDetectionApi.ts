/**
 * Set `EXPO_PUBLIC_FAKE_JOB_API_BASE_URL` in `FraudAware/.env`
 * (e.g. `http://192.168.1.250:8003`, no trailing slash). Restart Expo after changing.
 */
export function getFakeJobApiBase(): string {
  return (
    (process.env.EXPO_PUBLIC_FAKE_JOB_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:8003'
  );
}

export function getFakeJobPredictUrl(): string {
  return `${getFakeJobApiBase()}/predict`;
}
