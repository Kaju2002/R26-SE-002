/**
 * Maps numeric model output to plain-language tiers for the result UI.
 * Avoid presenting a raw % as the primary verdict (consumer trust / education norm).
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
