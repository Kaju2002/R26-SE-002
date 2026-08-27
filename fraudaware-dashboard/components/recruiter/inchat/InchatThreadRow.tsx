'use client';

import Link from 'next/link';
import { useInchatBasePath } from '@/lib/inchat/InchatBasePathContext';
import type { InchatThread } from '@/lib/inchat/types';
import {
  INCHAT_BLUE_DOT,
  INCHAT_BORDER,
  INCHAT_MUTED,
  INCHAT_NAVY,
} from '@/lib/inchat/inchatStyles';

type Props = {
  thread: InchatThread;
  isActive?: boolean;
  mode: 'stack' | 'split';
  onSelect?: () => void;
  /** Nested inside a grouped inbox row — no outer border. */
  embedded?: boolean;
};

function CompanyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M4 21h10M14 9h6v12h-6M18 13h2M18 17h2"
        stroke={INCHAT_NAVY}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThreadRowContent({ thread }: { thread: InchatThread }) {
  return (
    <>
      <div className="shrink-0">
        {thread.avatarKind === 'company' ? (
          thread.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thread.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-xl border object-cover"
              style={{ borderColor: INCHAT_BORDER, backgroundColor: '#F3F5F8' }}
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl border"
              style={{ borderColor: INCHAT_BORDER, backgroundColor: '#F3F5F8' }}
            >
              <CompanyIcon />
            </div>
          )
        ) : thread.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thread.avatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
            style={{ backgroundColor: '#EEF0F8' }}
          />
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: '#EEF0F8' }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
            >
              {thread.initials ?? '?'}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <p
            className="truncate text-sm font-bold text-[#111827]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {thread.participantName}
          </p>
          <span
            className="shrink-0 text-xs font-semibold"
            style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
          >
            {thread.timestampLabel}
          </span>
        </div>

        {thread.subtitle ? (
          <p
            className="mb-1 truncate text-xs font-semibold"
            style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
          >
            {thread.subtitle}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <p
            className="min-w-0 flex-1 truncate text-sm font-medium"
            style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
          >
            {thread.lastMessagePreview}
          </p>
          {thread.unreadCount > 0 ? (
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold text-white"
              style={{ backgroundColor: INCHAT_BLUE_DOT, fontFamily: 'var(--font-poppins)' }}
            >
              {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function InchatThreadRow({
  thread,
  isActive = false,
  mode,
  onSelect,
  embedded = false,
}: Props) {
  const basePath = useInchatBasePath();
  const className = `flex w-full items-stretch gap-3 text-left transition ${
    embedded ? 'px-4 py-3' : 'border-b px-4 py-3'
  } ${isActive ? 'bg-[#EEF0F8]' : embedded ? '' : 'hover:bg-[#FAFBFE]'}`;

  if (mode === 'split') {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={className}
        style={embedded ? undefined : { borderColor: INCHAT_BORDER }}
        aria-current={isActive ? 'true' : undefined}
      >
        <ThreadRowContent thread={thread} />
      </button>
    );
  }

  return (
    <Link
      href={`${basePath}/inchat/${thread.id}`}
      className={className}
      style={embedded ? undefined : { borderColor: INCHAT_BORDER }}
    >
      <ThreadRowContent thread={thread} />
    </Link>
  );
}
