/**
 * Set `EXPO_PUBLIC_SCAM_API_BASE_URL` in `FraudAware/.env` (e.g. `http://192.168.1.50:8000`, no trailing slash).
 * Restart Expo after changing.
 */
const base = (process.env.EXPO_PUBLIC_SCAM_API_BASE_URL ?? '')
  .trim()
  .replace(/\/$/, '') || 'http://127.0.0.1:8000';

export function getClassifyUrl(): string {
  return `${base}/classify`;
}

export function getClassifyImageUrl(): string {
  return `${base}/classify-image`;
}
