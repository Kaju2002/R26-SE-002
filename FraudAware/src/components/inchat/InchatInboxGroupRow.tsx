import React from 'react';
import type { InchatInboxRow } from '../../utils/groupInchatInbox';
import InchatThreadRow from './InchatThreadRow';

type Props = {
  row: InchatInboxRow;
  activeThreadId?: string;
  onSelectThread: (threadId: string) => void;
};

export default function InchatInboxGroupRow({
  row,
  activeThreadId,
  onSelectThread,
}: Props) {
  return (
    <InchatThreadRow
      thread={row.display}
      onPress={() => onSelectThread(row.display.id)}
    />
  );
}
