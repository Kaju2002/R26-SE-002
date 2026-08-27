'use client';

import type { InchatThread } from '@/lib/inchat/types';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';

type Props = {
  threads: InchatThread[];
  activeThreadId: string;
  onSelect: (threadId: string) => void;
};

export default function InchatApplicationSwitcher({
  threads,
  activeThreadId,
  onSelect,
}: Props) {
  if (threads.length <= 1) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {threads.map((thread) => {
        const label = thread.jobTitle || 'Application';
        const isActive = thread.id === activeThreadId;
        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            className="max-w-full truncate rounded-full border px-3 py-1 text-left text-xs font-semibold transition"
            style={{
              fontFamily: 'var(--font-poppins)',
              borderColor: isActive ? INCHAT_NAVY : INCHAT_BORDER,
              backgroundColor: isActive ? '#EEF0F8' : '#fff',
              color: isActive ? INCHAT_NAVY : INCHAT_MUTED,
            }}
            title={label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
