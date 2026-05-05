import {
  getClearHistoryUrl,
  getDeleteScanUrl,
  getHealthUrl,
  getHistoryUrl,
  getScanDetailUrl,
} from '../config/messageAnalyzerApi';
import type { HistoryApiScan } from '../utils/mapHistoryScan';

export type HealthApiResponse = {
  status?: string;
  model_loaded?: boolean;
  database_connected?: boolean;
};

export type HistoryApiResponse = {
  user_id: string;
  total: number;
  scans: HistoryApiScan[];
};

export type ScanDetailApiTactic = {
  name: string;
  key: string;
  score: number;
  description?: string;
  example?: string;
};

export type ScanDetailApiWord = {
  word: string;
  score: number;
};

export type ScanDetailApiResponse = {
  scan_id: string;
  is_scam: boolean;
  confidence: number;
  original_text: string;
  source?: string;
  created_at?: string | null;
  extracted_text?: string | null;
  tactics: ScanDetailApiTactic[];
  word_importance?: ScanDetailApiWord[];
  warning: string;
  what_gave_it_away: string;
};

async function readApiError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j?.detail === 'string') return j.detail;
    if (Array.isArray(j?.detail)) {
      const parts = (j.detail as { msg?: string }[]).map((d) => d?.msg).filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
  } catch {
    /* ignore */
  }
  return raw || `HTTP ${res.status}`;
}

export type HealthResult =
  | { ok: true; modelLoaded: boolean; dbConnected: boolean }
  | { ok: false; reason: 'unreachable' | 'bad_response'; message?: string };

export async function fetchHealth(): Promise<HealthResult> {
  const url = getHealthUrl();
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: 'bad_response',
      message: await readApiError(res),
    };
  }
  let body: HealthApiResponse;
  try {
    body = (await res.json()) as HealthApiResponse;
  } catch {
    return { ok: false, reason: 'bad_response', message: 'Invalid JSON from server' };
  }
  return {
    ok: true,
    modelLoaded: Boolean(body.model_loaded),
    dbConnected: Boolean(body.database_connected),
  };
}

export async function fetchScanDetail(scanId: string): Promise<ScanDetailApiResponse> {
  const url = getScanDetailUrl(scanId);
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as ScanDetailApiResponse;
}

export async function fetchHistory(userId: string): Promise<HistoryApiResponse> {
  const url = getHistoryUrl(userId);
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as HistoryApiResponse;
}

export async function deleteHistoryScan(scanId: string): Promise<void> {
  const url = getDeleteScanUrl(scanId);
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}

export async function clearAllHistory(userId: string): Promise<void> {
  const url = getClearHistoryUrl(userId);
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}
