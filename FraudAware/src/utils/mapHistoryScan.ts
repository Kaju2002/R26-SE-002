import type { RecentScanItem } from '../components/ui_component/recentScanTypes';
import { formatRelativeTime } from './formatRelativeTime';
import { tacticKeyToLabel } from './tacticLabels';

export type HistoryApiScan = {
  scan_id: string;
  is_scam: boolean;
  confidence: number;
  tactics: string[];
  preview_text: string;
  source: string;
  created_at: string;
};

export function historyScanToRecentItem(scan: HistoryApiScan): RecentScanItem {
  const isScam = scan.is_scam;
  return {
    id: scan.scan_id,
    status: isScam ? 'scam' : 'legit',
    title: isScam ? 'SCAM DETECTED' : 'LEGITIMATE',
    preview: scan.preview_text,
    timeAgo: formatRelativeTime(scan.created_at),
    confidence: scan.confidence,
    tactics: scan.tactics.map((key) => ({
      name: tacticKeyToLabel(key),
      example: '',
    })),
    originalText: scan.preview_text,
  };
}
