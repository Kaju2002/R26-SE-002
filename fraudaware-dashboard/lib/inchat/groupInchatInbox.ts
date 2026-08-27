import type { InchatThread } from '@/lib/inchat/types';

export type InchatInboxRow = {
  /** Conversation ids represented by this sidebar row. */
  threadIds: string[];
  /** Aggregated row shown in the inbox list. */
  display: InchatThread;
  /** Individual application threads (newest first). */
  threads: InchatThread[];
  isGrouped: boolean;
};

export function jobTitleFromSubtitle(subtitle?: string): string | undefined {
  if (!subtitle) {
    return undefined;
  }
  const prefix = 'Applied · ';
  if (subtitle.startsWith(prefix)) {
    return subtitle.slice(prefix.length).trim() || undefined;
  }
  return subtitle.trim() || undefined;
}

function sortKey(thread: InchatThread): string {
  return thread.updatedAtIso || '';
}

/**
 * Group recruiter inbox rows by candidate (peerUserId) so the same applicant
 * with multiple job applications appears once in the sidebar.
 */
export function buildInchatInboxRows(threads: InchatThread[]): InchatInboxRow[] {
  const byPeer = new Map<string, InchatThread[]>();

  for (const thread of threads) {
    const key = thread.peerUserId?.trim() || thread.id;
    const bucket = byPeer.get(key);
    if (bucket) {
      bucket.push(thread);
    } else {
      byPeer.set(key, [thread]);
    }
  }

  const rows: InchatInboxRow[] = [];

  for (const group of byPeer.values()) {
    if (group.length === 1) {
      rows.push({
        threadIds: [group[0].id],
        display: group[0],
        threads: group,
        isGrouped: false,
      });
      continue;
    }

    const sorted = [...group].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    const primary = sorted[0];
    const jobTitles = [
      ...new Set(
        sorted
          .map((thread) => thread.jobTitle || jobTitleFromSubtitle(thread.subtitle))
          .filter((title): title is string => Boolean(title))
      ),
    ];

    rows.push({
      threadIds: sorted.map((thread) => thread.id),
      isGrouped: true,
      threads: sorted,
      display: {
        ...primary,
        subtitle: `${group.length} applications · ${jobTitles.join(' · ')}`,
        unreadCount: sorted.reduce((sum, thread) => sum + thread.unreadCount, 0),
      },
    });
  }

  return rows.sort((a, b) => sortKey(b.display).localeCompare(sortKey(a.display)));
}

export function relatedThreadsFor(
  threads: InchatThread[],
  threadId: string
): InchatThread[] {
  const current = threads.find((thread) => thread.id === threadId);
  if (!current?.peerUserId) {
    return current ? [current] : [];
  }

  return threads
    .filter((thread) => thread.peerUserId === current.peerUserId)
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}
