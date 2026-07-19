'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  DotsVerticalIcon,
  PhoneIcon,
  VideoIcon,
} from '@/components/recruiter/inchat/InchatIcons';
import { useInchatBasePath } from '@/lib/inchat/InchatBasePathContext';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import type { InchatThread } from '@/lib/inchat/types';

type Props = {
  thread: InchatThread;
  showBack?: boolean;
  isTyping?: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  onClearChat?: () => void | Promise<void>;
};

export default function InchatConversationHeader({
  thread,
  showBack = false,
  isTyping = false,
  isOnline = false,
  lastSeenAt = null,
  onClearChat,
}: Props) {
  const basePath = useInchatBasePath();
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const lastSeen = lastSeenAt ? new Date(lastSeenAt) : null;
  const presenceLabel = isOnline
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
          <p
            className={`truncate text-xs font-medium ${isTyping ? 'italic' : ''}`}
            style={{
              color: isTyping ? '#2563EB' : INCHAT_MUTED,
              fontFamily: 'var(--font-poppins)',
            }}
          >
            {isTyping ? 'typing…' : presenceLabel}
          </p>
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
