/**
 * Parses FastAPI-style `{ detail }` errors from classify endpoints for alerts.
 */
export async function readClassifyError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === 'string') {
      return j.detail;
    }
    if (Array.isArray(j.detail) && j.detail.length > 0) {
      const first = j.detail[0] as { msg?: string };
      if (typeof first?.msg === 'string') {
        return first.msg;
      }
    }
  } catch {
    /* fall through */
  }
  if (text.length > 0 && text.length < 400) {
    return text;
  }
  return `Request failed (${response.status})`;
}
