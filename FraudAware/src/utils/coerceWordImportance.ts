export type WordImportance = {
  word: string;
  score: number;
};

/** Normalize API word_importance arrays from classify / scan detail responses. */
export function coerceWordImportance(raw: unknown): WordImportance[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const out: WordImportance[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const word =
      typeof record.word === 'string'
        ? record.word.trim()
        : typeof record.token === 'string'
          ? record.token.trim()
          : '';
    if (!word) {
      continue;
    }
    const key = word.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const scoreRaw = record.score;
    const score =
      typeof scoreRaw === 'number' && Number.isFinite(scoreRaw)
        ? Math.min(1, Math.max(0, scoreRaw))
        : 0.5;

    out.push({ word, score });
    if (out.length >= 12) {
      break;
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Split message text into renderable segments (words vs other). */
export function segmentAnalyzedText(text: string): string[] {
  if (!text) {
    return [];
  }
  return text.split(/(\s+|[^\w\s']+|\w+(?:'\w+)?)/g).filter((part) => part.length > 0);
}

export function normalizeWordToken(token: string): string {
  return token.replace(/^[^\w']+|[^\w']+$/g, '').toLowerCase();
}

export function buildWordHighlightLookup(
  words: WordImportance[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of words) {
    const key = normalizeWordToken(entry.word);
    if (!key) {
      continue;
    }
    const prev = map.get(key);
    if (prev === undefined || entry.score > prev) {
      map.set(key, entry.score);
    }
  }
  return map;
}

/** Pull flagged words from API explanation when word_importance is missing. */
export function parseWordsFromExplanation(explanation: string): WordImportance[] {
  const match = explanation.match(/The words\s+(.+?)\s+triggered/i);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(',')
    .map((part, index) => ({
      word: part.trim(),
      score: Math.max(0.4, 1 - index * 0.12),
    }))
    .filter((entry) => entry.word.length >= 2);
}

/** Merge API word_importance with words parsed from what_gave_it_away. */
export function mergeWordImportance(
  raw: unknown,
  explanation?: string
): WordImportance[] {
  const fromApi = coerceWordImportance(raw);
  const fromExplanation =
    typeof explanation === 'string' ? parseWordsFromExplanation(explanation) : [];

  if (!fromExplanation.length) {
    return fromApi;
  }
  if (!fromApi.length) {
    return fromExplanation;
  }

  const merged = new Map<string, WordImportance>();
  for (const entry of [...fromApi, ...fromExplanation]) {
    const key = normalizeWordToken(entry.word);
    if (!key) {
      continue;
    }
    const prev = merged.get(key);
    if (!prev || entry.score > prev.score) {
      merged.set(key, { word: entry.word, score: entry.score });
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 12);
}

/** Exact match first, then partial match for BERT subword fragments. */
export function scoreForHighlightedToken(
  token: string,
  lookup: Map<string, number>
): number | undefined {
  const normalized = normalizeWordToken(token);
  if (!normalized) {
    return undefined;
  }

  const direct = lookup.get(normalized);
  if (direct !== undefined) {
    return direct;
  }

  let best: number | undefined;
  for (const [key, score] of lookup) {
    if (key.length < 3 || normalized.length < 3) {
      continue;
    }
    if (normalized.includes(key) || key.includes(normalized)) {
      if (best === undefined || score > best) {
        best = score;
      }
    }
  }
  return best;
}
