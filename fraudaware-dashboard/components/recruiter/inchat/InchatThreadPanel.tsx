'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InchatComposer from '@/components/recruiter/inchat/InchatComposer';
import InchatConversationHeader from '@/components/recruiter/inchat/InchatConversationHeader';
import InchatMessageBubble from '@/components/recruiter/inchat/InchatMessageBubble';
import { useInchat } from '@/components/recruiter/inchat/InchatProvider';
import { INCHAT_MUTED } from '@/lib/inchat/inchatStyles';
import type { InchatMessage, InchatThread } from '@/lib/inchat/types';

type ThreadRow =
  | { type: 'date'; id: string; label: string }
  | { type: 'message'; id: string; message: InchatMessage };

function dateLabelForMessage(message: InchatMessage): string {
  if (message.createdAtIso) {
    const date = new Date(message.createdAtIso);
    const today = new Date();
    const isSameDate =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    return isSameDate
      ? 'Today'
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return /\d{1,2}:\d{2}/.test(message.timeLabel) ? 'Today' : message.timeLabel;
}

type Props = {
  thread: InchatThread;
  showBack?: boolean;
  hideHeader?: boolean;
};

export default function InchatThreadPanel({
  thread,
  showBack = false,
  hideHeader = false,
}: Props) {
  const { getCombinedMessages, appendRecruiterMessage, loadMessages } = useInchat();
  const [draft, setDraft] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => getCombinedMessages(thread.id),
    [getCombinedMessages, thread.id]
  );

  useEffect(() => {
    void loadMessages(thread.id);
  }, [loadMessages, thread.id]);

  const rows = useMemo<ThreadRow[]>(() => {
    const output: ThreadRow[] = [];
    let previousDate = '';
    for (const message of messages) {
      const dateLabel = dateLabelForMessage(message);
      if (dateLabel !== previousDate) {
        output.push({ type: 'date', id: `date-${dateLabel}-${message.id}`, label: dateLabel });
        previousDate = dateLabel;
      }
      output.push({ type: 'message', id: message.id, message });
    }
    return output;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text.length || sendBusy) return;
    setSendBusy(true);
    try {
      await appendRecruiterMessage(thread.id, text);
      setDraft('');
    } finally {
      setSendBusy(false);
    }
  }, [appendRecruiterMessage, draft, sendBusy, thread.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {!hideHeader ? <InchatConversationHeader thread={thread} showBack={showBack} /> : null}

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#FAFBFE] px-4 py-4">
        {rows.length === 0 ? (
          <p
            className="py-10 text-center text-sm font-semibold"
            style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
          >
            No messages in this thread.
          </p>
        ) : (
          rows.map((row) =>
            row.type === 'date' ? (
              <div key={row.id} className="mb-3 flex justify-center">
                <span
                  className="rounded-full bg-[#ECEFF4] px-3 py-1 text-xs font-bold text-[#6B7280]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {row.label}
                </span>
              </div>
            ) : (
              <InchatMessageBubble
                key={row.id}
                message={row.message}
                participantName={thread.participantName}
                participantInitials={thread.initials}
              />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      <InchatComposer
        value={draft}
        onChange={setDraft}
        onSend={() => void onSend()}
        sending={sendBusy}
      />
    </div>
  );
}
