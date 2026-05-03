const LABELS: Record<string, string> = {
  urgency: 'Urgency Pressure',
  fomo: 'FOMO',
  sunk_cost: 'Sunk-Cost Manipulation',
  social_proof: 'Social Proof Manipulation',
};

/** Maps backend tactic keys to short display titles for lists/sheets. */
export function tacticKeyToLabel(key: string): string {
  const k = key.trim();
  if (LABELS[k]) return LABELS[k];
  return k
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
