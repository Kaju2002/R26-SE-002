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

export function mergeAnalysisFromApi(dummy: AnalysisPayload, api: MergeableApiResult | undefined, pastedMessage: string): AnalysisPayload {
  const is_scam = pickBool(api, 'is_scam', 'isScam');
  const confidenceRaw = pickNumber(api, 'confidence', 'Confidence', 'confidence_score');
  const tacticsRaw = api?.tactics ?? api?.Tactics ?? api?.signals;
  const warning = pickStr(api, 'warning', 'Warning', 'advisory', 'risk_summary');
  const reassurance = pickStr(api, 'reassurance', 'Reassurance');
  const fromApi =
    pickStr(api, 'original_text', 'originalText', 'text', 'message') ??
    pastedMessage;
  const original_text =
    fromApi.trim().length > 0 ? fromApi : dummy.original_text;

  const tacticsFromApi = coerceTactics(tacticsRaw);

  let tactics: ParsedTactic[];
  if (is_scam === false) {
    tactics = tacticsFromApi;
  } else if (is_scam === true) {
    tactics = tacticsFromApi.length > 0 ? tacticsFromApi : dummy.tactics;
  } else {
    tactics = tacticsFromApi.length > 0 ? tacticsFromApi : dummy.tactics;
  }

  const outIsScam = typeof is_scam === 'boolean' ? is_scam : dummy.is_scam;
  let outWarning =
    typeof warning === 'string' && warning.trim().length > 0 ? warning.trim() : dummy.warning;
  let outReassurance =
    typeof reassurance === 'string' && reassurance.trim().length > 0 ? reassurance.trim() : dummy.reassurance;
  if (outIsScam) {
    outReassurance = '';
  } else {
    outWarning = '';
    if (!outReassurance) {
      outReassurance =
        dummy.reassurance ||
        'We did not find strong scam signals in this message. You should still verify the employer independently before sharing sensitive information.';
    }
  }

  return {
    is_scam: outIsScam,
    confidence:
      typeof confidenceRaw === 'number'
        ? coerceConfidencePct(confidenceRaw)
        : coerceConfidencePct(dummy.confidence),
    tactics,
    warning: outWarning,
    reassurance: outReassurance,
    original_text: original_text && original_text.length > 0 ? original_text : dummy.original_text,
  };
}
