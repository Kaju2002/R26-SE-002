/**
 * Set `EXPO_PUBLIC_SCAM_API_BASE_URL` in `FraudAware/.env` (e.g. `http://192.168.1.50:8000`, no trailing slash).
 * Restart Expo after changing.
 */
export function getApiBase(): string {
  return (
    (process.env.EXPO_PUBLIC_SCAM_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:8000'
  );
}

export function getClassifyUrl(): string {
  return `${getApiBase()}/classify`;
}

export function getClassifyImageUrl(): string {
  return `${getApiBase()}/classify-image`;
}

export function getOcrOnlyUrl(): string {
  return `${getApiBase()}/ocr-only`;
}

export function getHealthUrl(): string {
  return `${getApiBase()}/health`;
}

/** History routes use the logged-in user from the Authorization header. */
export function getHistoryUrl(): string {
  return `${getApiBase()}/history`;
}

export function getScanDetailUrl(scanId: string): string {
  return `${getApiBase()}/scan/${encodeURIComponent(scanId)}`;
}

export function getDeleteScanUrl(scanId: string): string {
  return `${getApiBase()}/history/${encodeURIComponent(scanId)}`;
}

export function getClearHistoryUrl(): string {
  return `${getApiBase()}/history`;
}
