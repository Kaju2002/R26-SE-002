export type ScanStatus = 'scam' | 'legit';

export type RecentScanTactic = {
  name: string;
  example?: string;
};

export type RecentScanItem = {
  id: string;
  status: ScanStatus;
  title: string;
  preview: string;
  timeAgo: string;
  confidence?: number;
  tactics?: RecentScanTactic[];
  warning?: string;
  reassurance?: string;
  /** Full message text; falls back to preview in UI if omitted */
  originalText?: string;
};
