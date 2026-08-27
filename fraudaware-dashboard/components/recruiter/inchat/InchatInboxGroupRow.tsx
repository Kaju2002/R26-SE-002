'use client';

import type { InchatInboxRow } from '@/lib/inchat/groupInchatInbox';
import InchatThreadRow from '@/components/recruiter/inchat/InchatThreadRow';

type Props = {
  row: InchatInboxRow;
  mode: 'stack' | 'split';
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
};

export default function InchatInboxGroupRow({
  row,
  mode,
  selectedThreadId,
  onSelectThread,
}: Props) {
  const isActive = selectedThreadId ? row.threadIds.includes(selectedThreadId) : false;

  return (
    <InchatThreadRow
      thread={row.display}
      mode={mode}
      isActive={isActive}
      onSelect={() => onSelectThread(row.display.id)}
    />
  );
}
