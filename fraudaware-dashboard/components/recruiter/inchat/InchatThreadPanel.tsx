'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InchatComposer from '@/components/recruiter/inchat/InchatComposer';
import InchatConversationHeader from '@/components/recruiter/inchat/InchatConversationHeader';
import InchatMessageBubble from '@/components/recruiter/inchat/InchatMessageBubble';
import { useInchat } from '@/components/recruiter/inchat/InchatProvider';
import { INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
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
  const {
    getCombinedMessages,
    appendRecruiterMessage,
    deleteMessage,
    clearConversation,
    setConversationSaved,
    setConversationStatus,
    loadMessages,
    leaveThread,
    isPeerTyping,
    getPeerPresence,
    setTyping,
  } = useInchat();
  const [draft, setDraft] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingActive = useRef(false);

  const messages = useMemo(
    () => getCombinedMessages(thread.id),
    [getCombinedMessages, thread.id]
  );
  const peerTyping = isPeerTyping(thread.id);
  const peerPresence = getPeerPresence(thread.id);
  const isBlocked = Boolean(thread.iBlocked);

  useEffect(() => {
    void loadMessages(thread.id);
  }, [loadMessages, thread.id]);

  useEffect(() => {
    return () => {
      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
      if (isTypingActive.current) {
        setTyping(thread.id, false);
        isTypingActive.current = false;
      }
      leaveThread(thread.id);
    };
  }, [leaveThread, setTyping, thread.id]);

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
  }, [messages.length, peerTyping]);

  const onDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (isBlocked) return;
      const hasText = value.trim().length > 0;

      if (hasText) {
        if (!isTypingActive.current) {
          isTypingActive.current = true;
          setTyping(thread.id, true);
        }
        if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
        typingIdleTimer.current = setTimeout(() => {
          if (isTypingActive.current) {
            isTypingActive.current = false;
            setTyping(thread.id, false);
          }
        }, 1500);
      } else if (isTypingActive.current) {
        if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
        isTypingActive.current = false;
        setTyping(thread.id, false);
      }
    },
    [isBlocked, setTyping, thread.id]
  );

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text.length || sendBusy || isBlocked) return;
    if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
    if (isTypingActive.current) {
      isTypingActive.current = false;
      setTyping(thread.id, false);
    }
    setSendBusy(true);
    try {
      await appendRecruiterMessage(thread.id, text);
      setDraft('');
    } finally {
      setSendBusy(false);
    }
  }, [appendRecruiterMessage, draft, isBlocked, sendBusy, setTyping, thread.id]);

  const onDelete = useCallback(
    async (message: InchatMessage, mode: 'me' | 'everyone') => {
      setDeleteError(null);
      setMenuMessageId(null);
      try {
        await deleteMessage(thread.id, message.id, mode);
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : 'Could not delete message.');
      }
    },
    [deleteMessage, thread.id]
  );

  const onBlock = useCallback(async () => {
    setStatusError(null);
    try {
      await setConversationStatus(thread.id, 'blocked');
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not block conversation.');
    }
  }, [setConversationStatus, thread.id]);

  const onUnblock = useCallback(async () => {
    setStatusError(null);
    try {
      await setConversationStatus(thread.id, 'active');
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not unblock conversation.');
    }
  }, [setConversationStatus, thread.id]);

  const onArchive = useCallback(async () => {
    setStatusError(null);
    try {
      await setConversationStatus(thread.id, 'archived');
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not archive conversation.');
      throw error;
    }
  }, [setConversationStatus, thread.id]);

  const onUnarchive = useCallback(async () => {
    setStatusError(null);
    try {
      await setConversationStatus(thread.id, 'active');
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not unarchive conversation.');
      throw error;
    }
  }, [setConversationStatus, thread.id]);

  const onSave = useCallback(async () => {
    setStatusError(null);
    try {
      await setConversationSaved(thread.id, true);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not save conversation.');
      throw error;
    }
  }, [setConversationSaved, thread.id]);

  const onUnsave = useCallback(async () => {
    setStatusError(null);
    try {
      await setConversationSaved(thread.id, false);
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : 'Could not remove saved conversation.'
      );
      throw error;
    }
  }, [setConversationSaved, thread.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {!hideHeader ? (
        <InchatConversationHeader
          thread={thread}
          showBack={showBack}
          isTyping={peerTyping}
          isOnline={peerPresence.isOnline}
          lastSeenAt={peerPresence.lastSeenAt}
          onClearChat={() => clearConversation(thread.id)}
          onBlock={onBlock}
          onUnblock={onUnblock}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onSave={onSave}
          onUnsave={onUnsave}
        />
      ) : null}

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto bg-[#FAFBFE] px-4 py-4">
        {statusError ? (
          <p
            className="mb-3 text-center text-xs font-semibold text-red-600"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {statusError}
          </p>
        ) : null}
        {deleteError ? (
          <p
            className="mb-3 text-center text-xs font-semibold text-red-600"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {deleteError}
          </p>
        ) : null}
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
              <div key={row.id} className="relative">
                <button
                  type="button"
                  className="w-full text-left"
                  onContextMenu={(event) => {
                    if (row.message.deletedForEveryone || row.message.unsent) return;
                    event.preventDefault();
                    setMenuMessageId(row.message.id);
                  }}
                  onClick={() => {
                    if (menuMessageId === row.message.id) setMenuMessageId(null);
                  }}
                >
                  <InchatMessageBubble
                    message={row.message}
                    participantName={thread.participantName}
                    participantInitials={thread.initials}
                    participantAvatarUrl={thread.avatarUrl}
                  />
                </button>
                {menuMessageId === row.message.id ? (
                  <div
                    className={`absolute z-20 mt-[-8px] min-w-[180px] rounded-xl border bg-white py-1 shadow-lg ${
                      row.message.role === 'recruiter' ? 'right-0' : 'left-10'
                    }`}
                    style={{ borderColor: '#EEF0F8' }}
                  >
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-[#F7F8FE]"
                      style={{ fontFamily: 'var(--font-poppins)' }}
                      onClick={() => void onDelete(row.message, 'me')}
                    >
                      Delete for me
                    </button>
                    {row.message.role === 'recruiter' ? (
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[#F7F8FE]"
                        style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
                        onClick={() => void onDelete(row.message, 'everyone')}
                      >
                        Delete for everyone
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm font-medium hover:bg-[#F7F8FE]"
                      style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
                      onClick={() => setMenuMessageId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            )
          )
        )}
        {peerTyping ? (
          <p
            className="mt-2 text-xs font-semibold italic text-[#2563EB]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {thread.participantName} is typing…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0">
        {isBlocked ? (
          <p
            className="border-t bg-[#FEF3F2] px-4 py-2 text-center text-xs font-semibold text-[#B42318]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            You blocked this conversation. Unblock to message again.
          </p>
        ) : null}
        <InchatComposer
          value={draft}
          onChange={onDraftChange}
          onSend={() => void onSend()}
          sending={sendBusy}
          disabled={isBlocked}
          templateVariables={{
            name: thread.participantName,
            jobTitle: thread.subtitle,
          }}
        />
      </div>
    </div>
  );
}
