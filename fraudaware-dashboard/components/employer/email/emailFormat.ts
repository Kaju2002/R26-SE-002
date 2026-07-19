import type { EmailParticipant } from '@/lib/api/emailApi';

export function participantLabel(participants: EmailParticipant[]): string {
  const first = participants[0];
  if (!first) return 'Unknown';
  return first.name?.trim() || first.email || 'Unknown';
}

export function formatRelativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ensureReSubject(subject: string): string {
  const trimmed = subject.trim() || '(No subject)';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function ensureFwdSubject(subject: string): string {
  const trimmed = subject.trim() || '(No subject)';
  return /^fwd:/i.test(trimmed) ? trimmed : `Fwd: ${trimmed}`;
}
