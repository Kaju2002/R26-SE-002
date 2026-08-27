const LABELS: Record<string, string> = {
  urgency: 'Urgency Pressure',
  fomo: 'FOMO',
  sunk_cost: 'Sunk-Cost Manipulation',
  social_proof: 'Social Proof Manipulation',
};

/** Short labels for compact chips inside chat bubbles. */
const CHIP_LABELS: Record<string, string> = {
  urgency: 'Urgency',
  fomo: 'FOMO',
  sunk_cost: 'Sunk cost',
  social_proof: 'Social proof',
  fee: 'Fee request',
  payment: 'Fee request',
  payment_request: 'Fee request',
  scarcity: 'Scarcity',
  authority: 'Authority',
};

/** Maps backend tactic keys to short display titles for lists/sheets. */
export function tacticKeyToLabel(key: string): string {
  const k = key.trim();
  if (LABELS[k]) return LABELS[k];
  return k
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Compact chip label for in-chat scam warnings. */
export function tacticKeyToChipLabel(key: string): string {
  const k = key.trim().toLowerCase();
  if (CHIP_LABELS[k]) return CHIP_LABELS[k];
  return tacticKeyToLabel(key);
}

