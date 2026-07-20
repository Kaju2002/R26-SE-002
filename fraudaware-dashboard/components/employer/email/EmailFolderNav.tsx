'use client';

import type { ReactNode } from 'react';
import type { EmailFolder } from '@/lib/api/emailApi';
import { colors } from '@/lib/theme/colors';

function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8l8 5 8-5M5 19h14a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l16-7-7 16-2.5-6.5L4 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 19h14M7 15l9.5-9.5a1.5 1.5 0 012.1 2.1L9.1 17.1 7 15z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpamIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l9 16H3L12 3zM12 10v4M12 16.5v.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 11v6M14 11v6M7 7l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FOLDER_META: Record<string, { label: string; icon: ReactNode }> = {
  inbox: { label: 'Inbox', icon: <InboxIcon /> },
  sent: { label: 'Sent', icon: <SentIcon /> },
  drafts: { label: 'Draft', icon: <DraftIcon /> },
  spam: { label: 'Spam', icon: <SpamIcon /> },
  trash: { label: 'Trash', icon: <TrashIcon /> },
};

type Props = {
  folders: EmailFolder[];
  activeKey: string;
  onSelect: (key: string) => void;
  onCompose: () => void;
};

export default function EmailFolderNav({
  folders,
  activeKey,
  onSelect,
  onCompose,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col border-r border-[#EEF0F8] bg-white lg:w-[220px] lg:shrink-0">
      <div className="p-4">
        <button
          type="button"
          onClick={onCompose}
          className="w-full rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2160]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Compose
        </button>
      </div>

      <div className="px-3 pb-2">
        <p
          className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          Folders
        </p>
        <nav className="space-y-1">
          {folders.map((folder) => {
            const meta = FOLDER_META[folder.key] ?? {
              label: folder.name,
              icon: <InboxIcon />,
            };
            const active = folder.key === activeKey;
            return (
              <button
                key={folder.key}
                type="button"
                onClick={() => onSelect(folder.key)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? 'bg-[#EEF0F8] font-semibold text-[#202871]'
                    : 'text-[#42498A] hover:bg-[#F7F8FE]'
                }`}
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                <span className="flex items-center gap-2.5">
                  <span className="opacity-80">{meta.icon}</span>
                  {meta.label}
                </span>
                {folder.unreadCount != null && folder.unreadCount > 0 ? (
                  <span
                    className="rounded-full bg-[#202871] px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ fontFamily: 'var(--font-poppins)' }}
                  >
                    {folder.unreadCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
