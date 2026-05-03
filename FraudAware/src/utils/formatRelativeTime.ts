/**
 * Parses API timestamps. Naive ISO strings (no `Z` / offset) were interpreted by JS as *local*
 * time while Mongo stores UTC — that skewed "5h ago" by your timezone offset (e.g. ~5.5h in India).
 * Legacy rows without a suffix are treated as UTC; new API responses use `...Z` from the server.
 */
export function parseUtcIso(iso: string): Date {
  const s = iso.trim();
  if (!s) return new Date(NaN);
  if (/[zZ]$/.test(s)) return new Date(s);
  // Offset form, e.g. +05:30 or +00:00
  if (/[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  // Naive "2026-05-03T12:00:00(.fff)?" → UTC
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
}

/** ISO 8601 → short relative label for UI lists. */
export function formatRelativeTime(iso: string): string {
  const d = parseUtcIso(iso);
  if (Number.isNaN(d.getTime())) return '';

  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
