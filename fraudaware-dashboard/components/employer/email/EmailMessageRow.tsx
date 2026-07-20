'use client';

import type { EmailMessageSummary } from '@/lib/api/emailApi';
import { colors } from '@/lib/theme/colors';
import { formatRelativeTime, participantLabel } from './emailFormat';

type Props = {
  message: EmailMessageSummary;
  selected: boolean;
  onSelect: () => void;
};

export default function EmailMessageRow({ message, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border-b border-[#EEF0F8] px-4 py-3.5 text-left transition ${
        selected ? 'bg-[#F0F3FF]' : 'bg-white hover:bg-[#F7F8FE]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`truncate text-sm ${message.unread ? 'font-semibold' : 'font-medium'}`}
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {participantLabel(message.from)}
        </p>
        <span
          className="shrink-0 text-[11px]"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {formatRelativeTime(message.date)}
        </span>
      </div>
      <p
        className={`mt-1 truncate text-sm ${message.unread ? 'font-medium' : ''}`}
        style={{
          color: message.unread ? colors.navy : colors.body,
          fontFamily: 'var(--font-poppins)',
        }}
      >
        {message.subject}
      </p>
      <p
        className="mt-0.5 line-clamp-1 text-xs"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {message.snippet || 'No preview'}
      </p>
    </button>
  );
}
