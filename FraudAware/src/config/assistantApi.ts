/**
 * Set `EXPO_PUBLIC_ASSISTANT_API_BASE_URL` in `FraudAware/.env`
 * (e.g. `http://192.168.1.250:8004`, no trailing slash). Restart Expo after changing.
 */
export function getAssistantApiBase(): string {
  return (
    (process.env.EXPO_PUBLIC_ASSISTANT_API_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'http://127.0.0.1:8004'
  );
}

export function getAssistantMessageUrl(): string {
  return `${getAssistantApiBase()}/assistant/message`;
}

export function getAssistantSessionUrl(sessionId: string): string {
  return `${getAssistantApiBase()}/assistant/session/${encodeURIComponent(sessionId)}`;
}
