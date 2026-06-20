/**
 * Maps numeric model output to plain-language tiers for the result UI.
 * Raw % is shown together with verdict-specific labels so users do not read it
 * as a standalone “scam vs legitimate” split (the backend uses one confidence field
 * with different meanings for scam vs safe classifications).
 */

export type SignalStrengthInput = {
  isScam: boolean;
  inconclusive?: boolean;
  /** 0–100 */
  confidencePct: number;
};

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Short label shown in the main “signal strength” stat card. */
export function getSignalStrengthHeadline(input: SignalStrengthInput): string {
  const inconclusive = input.inconclusive === true;
  const c = clampPct(input.confidencePct);

  if (inconclusive) {
    if (c <= 1) {
      return 'Not enough text';
    }
    if (c < 50) {
      return 'Uncertain read';
    }
    return 'Mixed signals';
  }

  if (input.isScam) {
    if (c >= 80) {
      return 'Strong signals';
    }
    if (c >= 55) {
      return 'Moderate signals';
    }
    return 'Some signals';
  }

  if (c >= 70) {
    return 'Typical patterns';
  }
  if (c >= 42) {
    return 'Generally consistent';
  }
  return 'Limited read';
}

export type ConfidenceScoreCopy = {
  /** Short name for what the numeric score represents */
  metricLabel: string;
  /** One line clarifying what this percentage is not */
  footnote: string;
};

/**
 * Labels for the API `confidence` field (0–100), which is defined differently
 * for scam vs legitimate vs inconclusive paths in `predictor.combine`.
 */
export function getConfidenceScoreCopy(input: {
  isScam: boolean;
  inconclusive: boolean;
}): ConfidenceScoreCopy {
  if (input.inconclusive) {
    return {
      metricLabel: 'Read strength',
      footnote: 'This number is not a scam vs. safe split — it reflects how much signal we got from the text.',
    };
  }
  if (input.isScam) {
    return {
      metricLabel: 'Pattern strength',
      footnote: 'How strong the clearest flagged pattern is — not a separate "legitimate" percentage.',
    };
  }
  return {
    metricLabel: 'Safe-read confidence',
    footnote: 'How sure the model is this looks like normal outreach — not "remaining scam risk".',
  };
}

/** Clamp and round for display (API sends integer 0–100; mapping may produce decimals). */
export function displayConfidencePercent(confidencePct: number): number {
  return Math.min(100, Math.max(0, Math.round(confidencePct)));
}
