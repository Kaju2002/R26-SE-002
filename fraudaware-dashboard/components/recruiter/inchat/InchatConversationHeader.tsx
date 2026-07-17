'use client';

import Link from 'next/link';
import {
  DotsVerticalIcon,
  PhoneIcon,
  VideoIcon,
} from '@/components/recruiter/inchat/InchatIcons';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import type { InchatThread } from '@/lib/inchat/types';

type Props = {
  thread: InchatThread;
  showBack?: boolean;
  isTyping?: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
};

export default function InchatConversationHeader({
  thread,
  showBack = false,
  isTyping = false,
  isOnline = false,
  lastSeenAt = null,
}: Props) {
  const lastSeen = lastSeenAt ? new Date(lastSeenAt) : null;
  const presenceLabel = isOnline
    ? 'online'
    : lastSeen && !Number.isNaN(lastSeen.getTime())
      ? `last seen ${lastSeen.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })}`
      : 'offline';

  return (
    <header
      className="flex h-[72px] shrink-0 items-center gap-2 border-b bg-white px-4"
      style={{ borderColor: INCHAT_BORDER }}
    >
      {showBack ? (
        <Link
          href="/recruiter/inchat"
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

      <div className="flex items-center gap-1">
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
          onClick={() => alert('More options coming soon.')}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#42498A] transition hover:bg-[#EEF0F8]"
          aria-label="More options"
        >
          <DotsVerticalIcon />
        </button>
      </div>
    </header>
  );
}
