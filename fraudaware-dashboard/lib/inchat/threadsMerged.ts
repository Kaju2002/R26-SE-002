import { MOCK_INCHAT_THREADS } from './mockThreads';
import { getMockMessagesForThread } from './mockMessages';
import type { InchatMessage, InchatThread } from './types';

export function threadsWithExtras(
  extrasByThread: Record<string, InchatMessage[]>
): InchatThread[] {
  return MOCK_INCHAT_THREADS.map((thread) => {
    const messages = [
      ...getMockMessagesForThread(thread.id),
      ...(extrasByThread[thread.id] ?? []),
    ];
    if (messages.length === 0) return thread;

    const last = messages[messages.length - 1];
    const preview =
      last.body.length > 100 ? `${last.body.slice(0, 97)}…` : last.body;

    return {
      ...thread,
      lastMessagePreview: preview,
      timestampLabel: last.timeLabel,
    };
  });
}
