/**
 * Set `EXPO_PUBLIC_EMPLOYER_API_BASE_URL` in `FraudAware/.env`
 * (e.g. `http://192.168.1.250:8001`, no trailing slash). Restart Expo after changing.
 */
export function getEmployerApiBase(): string {
  return (
    (process.env.EXPO_PUBLIC_EMPLOYER_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:8001'
  );
}

export function getEmployerPredictUrl(): string {
  return `${getEmployerApiBase()}/predict`;
}
