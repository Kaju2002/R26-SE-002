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

export function getFakeJobExplainUrl(): string {
  return `${getFakeJobApiBase()}/explain-text`;
}

export type JobImageMeta = {
  name?: string | null;
  type?: string | null;
};

function guessImageMeta(uri: string, meta?: JobImageMeta) {
  const fromUri = uri.split('?')[0]?.split('.').pop()?.toLowerCase() || 'jpg';
  const ext = fromUri === 'jpeg' ? 'jpg' : fromUri;
  const type =
    meta?.type ||
    (ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg');
  const name = meta?.name || `job_post.${ext}`;
  return { name, type };
}

async function blobFromUri(uri: string, type: string): Promise<Blob> {
  const response = await fetch(uri);
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('Could not read the selected image.');
  }
  if (blob.type && blob.type !== 'application/octet-stream') {
    return blob;
  }
  return new Blob([blob], { type });
}

export async function predictJobPosterFromUri(
  uri: string,
  meta?: JobImageMeta
): Promise<Record<string, unknown>> {
  const { name, type } = guessImageMeta(uri, meta);
  const blob = await blobFromUri(uri, type);
  const form = new FormData();
  const file =
    typeof File !== 'undefined'
      ? new File([blob], name, { type: blob.type || type })
      : blob;
  form.append('image', file, name);

  const response = await fetch(getFakeJobPredictUrl(), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = data.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? 'Could not upload the image. Try another photo.'
          : typeof data.message === 'string'
            ? data.message
            : `Upload failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}
