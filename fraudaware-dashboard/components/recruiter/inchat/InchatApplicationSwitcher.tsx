'use client';

import { applicationChipLabel } from '@/lib/inchat/groupInchatInbox';
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
      {threads.map((thread, index) => {
        const label = applicationChipLabel(thread, index);
        const isActive = thread.id === activeThreadId;
        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            className="max-w-[200px] truncate rounded-[10px] border-[1.5px] px-3.5 py-2 text-left text-[13px] font-bold transition"
            style={{
              fontFamily: 'var(--font-poppins)',
              borderColor: isActive ? INCHAT_NAVY : INCHAT_BORDER,
              backgroundColor: isActive ? INCHAT_NAVY : '#fff',
              color: isActive ? '#fff' : INCHAT_MUTED,
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
