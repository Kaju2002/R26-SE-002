'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  DotsVerticalIcon,
  PhoneIcon,
  VideoIcon,
} from '@/components/recruiter/inchat/InchatIcons';
import { useInchatBasePath } from '@/lib/inchat/InchatBasePathContext';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import type { InchatThread } from '@/lib/inchat/types';
import InchatApplicationSwitcher from '@/components/recruiter/inchat/InchatApplicationSwitcher';

type Props = {
  thread: InchatThread;
  showBack?: boolean;
  isTyping?: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  onClearChat?: () => void | Promise<void>;
  onBlock?: () => void | Promise<void>;
  onUnblock?: () => void | Promise<void>;
  onArchive?: () => void | Promise<void>;
  onUnarchive?: () => void | Promise<void>;
  onSave?: () => void | Promise<void>;
  onUnsave?: () => void | Promise<void>;
  relatedThreads?: InchatThread[];
  onSelectThread?: (threadId: string) => void;
};

export default function InchatConversationHeader({
  thread,
  showBack = false,
  isTyping = false,
  isOnline = false,
  lastSeenAt = null,
  onClearChat,
  onBlock,
  onUnblock,
  onArchive,
  onUnarchive,
  onSave,
  onUnsave,
  relatedThreads = [],
  onSelectThread,
}: Props) {
  const basePath = useInchatBasePath();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isBlocked = Boolean(thread.iBlocked);
  const isArchived = thread.status === 'archived';
  const isSaved = Boolean(thread.saved);
  const conversationIsBlocked = thread.status === 'blocked';

  const lastSeen = lastSeenAt ? new Date(lastSeenAt) : null;
  const presenceLabel = isBlocked
    ? 'Blocked'
    : isOnline
      ? 'online'
      : lastSeen && !Number.isNaN(lastSeen.getTime())
        ? `last seen ${lastSeen.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : 'offline';

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  const handleClearChat = async () => {
    if (!onClearChat || clearing) return;
    const confirmed = window.confirm(
      'Clear chat for you only? The other person will still keep the messages.'
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      await onClearChat();
      setMenuOpen(false);
    } finally {
      setClearing(false);
    }
  };

  const handleToggleBlock = async () => {
    if (statusBusy) return;
    if (isBlocked) {
      if (!onUnblock) return;
      const confirmed = window.confirm(
        'Unblock this conversation? You will be able to message again.'
      );
      if (!confirmed) return;
      setStatusBusy(true);
      try {
        await onUnblock();
        setMenuOpen(false);
      } finally {
        setStatusBusy(false);
      }
      return;
    }

    if (!onBlock) return;
    const confirmed = window.confirm(
      'Block this conversation? They will not be told. Their messages will not be delivered to you.'
    );
    if (!confirmed) return;
    setStatusBusy(true);
    try {
      await onBlock();
      setMenuOpen(false);
    } finally {
      setStatusBusy(false);
    }
  };

  const handleToggleArchive = async () => {
    if (statusBusy) return;
    const action = isArchived ? onUnarchive : onArchive;
    if (!action) return;
    const confirmed = window.confirm(
      isArchived
        ? 'Unarchive this conversation? It will return to the main inbox.'
        : 'Archive this conversation? It will move to Archived for both participants.'
    );
    if (!confirmed) return;
    setStatusBusy(true);
    try {
      await action();
      setMenuOpen(false);
      router.push(`${basePath}/inchat`);
    } catch {
      // The parent action surfaces the request error next to the conversation.
    } finally {
      setStatusBusy(false);
    }
  };

  const handleToggleSaved = async () => {
    if (statusBusy) return;
    const action = isSaved ? onUnsave : onSave;
    if (!action) return;
    setStatusBusy(true);
    try {
      await action();
      setMenuOpen(false);
    } catch {
      // The parent action surfaces the request error next to the conversation.
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <header
      className="flex h-[72px] shrink-0 items-center gap-2 border-b bg-white px-4"
      style={{ borderColor: INCHAT_BORDER }}
    >
      {showBack ? (
        <Link
          href={`${basePath}/inchat`}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#202871] transition hover:bg-[#EEF0F8] lg:hidden"
          aria-label="Back to inbox"
        >
          ←
        </Link>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {thread.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thread.avatarUrl}
            alt=""
            className={`h-10 w-10 shrink-0 object-cover ${
              thread.avatarKind === 'person' ? 'rounded-full' : 'rounded-xl border'
            }`}
            style={{
              backgroundColor: '#EEF0F8',
              borderColor: thread.avatarKind === 'company' ? INCHAT_BORDER : undefined,
            }}
          />
        ) : (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center ${
              thread.avatarKind === 'person' ? 'rounded-full' : 'rounded-xl border'
            }`}
            style={{
              backgroundColor: '#EEF0F8',
              borderColor: thread.avatarKind === 'company' ? INCHAT_BORDER : undefined,
            }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
            >
              {thread.avatarKind === 'person' ? thread.initials ?? '?' : 'FA'}
            </span>
          </div>
        )}

        <div className="min-w-0">
          <p
            className="truncate text-base font-semibold"
            style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
          >
            {thread.participantName}
          </p>
          {thread.jobTitle && relatedThreads.length <= 1 ? (
            <p
              className="truncate text-xs font-semibold"
              style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
            >
              {thread.jobTitle}
            </p>
          ) : null}
          <p
            className={`truncate text-xs font-medium ${isTyping && !isBlocked ? 'italic' : ''}`}
            style={{
              color: isBlocked ? '#B42318' : isTyping ? '#2563EB' : INCHAT_MUTED,
              fontFamily: 'var(--font-poppins)',
            }}
          >
            {isTyping && !isBlocked ? 'typing…' : presenceLabel}
          </p>
          {relatedThreads.length > 1 && onSelectThread ? (
            <InchatApplicationSwitcher
              threads={relatedThreads}
              activeThreadId={thread.id}
              onSelect={onSelectThread}
            />
          ) : null}
        </div>
      </div>

      <div className="relative flex items-center gap-1" ref={menuRef}>
        <button
          type="button"
          onClick={() => alert('Voice call will be available in a future release.')}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#42498A] transition hover:bg-[#EEF0F8]"
          aria-label="Phone"
        >
          <PhoneIcon />
        </button>
        <button
          type="button"
          onClick={() => alert('Video call will be available in a future release.')}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#42498A] transition hover:bg-[#EEF0F8]"
          aria-label="Video"
        >
          <VideoIcon />
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#42498A] transition hover:bg-[#EEF0F8]"
          aria-label="More options"
          aria-expanded={menuOpen}
        >
          <DotsVerticalIcon />
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-11 z-30 min-w-[180px] rounded-xl border bg-white py-1 shadow-lg"
            style={{ borderColor: INCHAT_BORDER }}
          >
            <button
              type="button"
              disabled={statusBusy || (isSaved ? !onUnsave : !onSave)}
              onClick={() => void handleToggleSaved()}
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-[#202871] transition hover:bg-[#F7F8FE] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {statusBusy ? 'Updating…' : isSaved ? 'Remove from saved' : 'Save'}
            </button>
            <button
              type="button"
              disabled={statusBusy || (isBlocked ? !onUnblock : !onBlock)}
              onClick={() => void handleToggleBlock()}
              className={`block w-full px-3 py-2 text-left text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-50 ${
                isBlocked ? 'text-[#202871]' : 'text-red-600'
              }`}
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {statusBusy ? 'Updating…' : isBlocked ? 'Unblock' : 'Block'}
            </button>
            {!conversationIsBlocked ? (
              <button
                type="button"
                disabled={statusBusy || (isArchived ? !onUnarchive : !onArchive)}
                onClick={() => void handleToggleArchive()}
                className="block w-full px-3 py-2 text-left text-sm font-semibold text-[#202871] transition hover:bg-[#F7F8FE] disabled:opacity-50"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {statusBusy ? 'Updating…' : isArchived ? 'Unarchive' : 'Archive'}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!onClearChat || clearing}
              onClick={() => void handleClearChat()}
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-[#F7F8FE] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {clearing ? 'Clearing…' : 'Clear chat'}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
