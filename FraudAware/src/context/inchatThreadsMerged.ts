import { INCHAT_THREADS, type InchatThread } from '../../data/inchatThreads';
import { getMessagesForThread, type InchatMessage } from '../../data/inchatMessages';

export function threadsWithExtras(
  extrasByThread: Record<string, InchatMessage[]>
): InchatThread[] {
  return INCHAT_THREADS.map((t) => {
    const msgs = [...getMessagesForThread(t.id), ...(extrasByThread[t.id] ?? [])];
    if (msgs.length === 0) return t;
    const last = msgs[msgs.length - 1];
    const preview =
      last.body.length > 100 ? `${last.body.slice(0, 97)}…` : last.body;
    return {
      ...t,
      lastMessagePreview: preview,
      timestampLabel: last.timeLabel,
    };
  });
}
