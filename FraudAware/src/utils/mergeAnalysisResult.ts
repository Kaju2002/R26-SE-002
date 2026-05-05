import type { AnalysisPayload, MergeableApiResult, ParsedTactic } from '../navigation/detectStackTypes';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function coerceTactics(raw: unknown): ParsedTactic[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item): ParsedTactic => {
    if (typeof item === 'string') {
      return { name: item, example: '' };
    }
    if (!isRecord(item)) {
      return { name: 'Unknown tactic', example: '' };
    }
    const name =
      typeof item.name === 'string'
        ? item.name
        : typeof item.title === 'string'
          ? item.title
          : typeof item.tactic === 'string'
            ? item.tactic
            : 'Tactic';
    const example =
      typeof item.example === 'string'
        ? item.example
        : typeof item.description === 'string'
          ? item.description
          : typeof item.snippet === 'string'
            ? item.snippet
            : typeof item.quote === 'string'
              ? item.quote
              : '';
    return { name, example };
  });
}

function pickBool(obj: MergeableApiResult | undefined, ...keys: string[]): boolean | undefined {
  if (!obj) {
    return undefined;
  }
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'boolean') {
      return v;
    }
  }
  return undefined;
}

function pickNumber(obj: MergeableApiResult | undefined, ...keys: string[]): number | undefined {
  if (!obj) {
    return undefined;
  }
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      return v;
    }
  }
  return undefined;
}

function pickStr(obj: MergeableApiResult | undefined, ...keys: string[]): string | undefined {
  if (!obj) {
    return undefined;
  }
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string') {
      return v;
    }
  }
  return undefined;
}

export function coerceConfidencePct(n: unknown, fallback = 0): number {
  if (typeof n !== 'number' || Number.isNaN(n)) {
    return Math.round(fallback * 100) / 100;
  }
  let pct: number;
  if (n > 0 && n <= 1) {
    pct = n * 100;
  } else {
    pct = n;
  }
  pct = Math.min(100, Math.max(0, pct));
  return Math.round(pct * 100) / 100;
}

const DEFAULT_REASSURANCE =
  'We did not find strong scam signals in this message. You should still verify the employer independently before sharing sensitive information.';

const DEFAULT_INCONCLUSIVE_NOTE =
  'We could not reach a confident safe vs. scam verdict from this input. Add more recruiter message context and try again.';

/**
 * Maps a `/classify` or `/classify-image` JSON body to UI payload. Returns null if `is_scam` is missing.
 */
export function analysisPayloadFromApi(api: MergeableApiResult, pastedMessage: string): AnalysisPayload | null {
  const is_scam = pickBool(api, 'is_scam', 'isScam');
  if (typeof is_scam !== 'boolean') {
    return null;
  }

  const inconclusive = pickBool(api, 'inconclusive') === true;
  const confidenceRaw = pickNumber(api, 'confidence', 'Confidence', 'confidence_score');
  const tacticsRaw = api?.tactics ?? api?.Tactics ?? api?.signals;
  const warning = pickStr(api, 'warning', 'Warning', 'advisory', 'risk_summary');
  const reassurance = pickStr(api, 'reassurance', 'Reassurance');
  const whatGave = pickStr(api, 'what_gave_it_away', 'whatGaveItAway');
  const pickedText = pickStr(api, 'original_text', 'originalText', 'text', 'message', 'extracted_text');

  const combinedForOriginal =
    typeof pickedText === 'string' && pickedText.length > 0
      ? pickedText
      : typeof pastedMessage === 'string' && pastedMessage.length > 0
        ? pastedMessage
        : '';
  const original_text = combinedForOriginal.trim();

  const tacticsFromApi = coerceTactics(tacticsRaw);

  const apiWarning = typeof warning === 'string' ? warning.trim() : '';
  let outReassurance = typeof reassurance === 'string' ? reassurance.trim() : '';

  let outWarning: string;
  if (is_scam) {
    outWarning = apiWarning;
    if (!outWarning && typeof whatGave === 'string' && whatGave.trim()) {
      outWarning = whatGave.trim();
    }
    outReassurance = '';
  } else if (inconclusive) {
    outWarning = '';
    outReassurance =
      (typeof whatGave === 'string' && whatGave.trim()) ||
      apiWarning ||
      DEFAULT_INCONCLUSIVE_NOTE;
  } else {
    outWarning = '';
    if (!outReassurance && typeof whatGave === 'string' && whatGave.trim()) {
      outReassurance = whatGave.trim();
    }
    if (!outReassurance && apiWarning) {
      outReassurance = apiWarning;
    }
    if (!outReassurance) {
      outReassurance = DEFAULT_REASSURANCE;
    }
  }

  return {
    is_scam,
    inconclusive: inconclusive || undefined,
    confidence:
      typeof confidenceRaw === 'number' ? coerceConfidencePct(confidenceRaw) : 0,
    tactics: is_scam && !inconclusive ? tacticsFromApi : [],
    warning: outWarning,
    reassurance: outReassurance,
    original_text: original_text.length > 0 ? original_text : '(No text)',
    word_importance: [],
  };
}
