'use client';

import { SearchIcon } from '@/components/recruiter/inchat/InchatIcons';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
};

export default function InchatInboxHeader({ query, onQueryChange }: Props) {
  return (
    <div
      className="flex items-center gap-2 px-5 pb-3 pt-4"
      style={{ borderColor: INCHAT_BORDER, backgroundColor: '#fff' }}
    >
      <div
        className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border bg-white px-3 py-2"
        style={{ borderColor: INCHAT_BORDER }}
      >
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search contacts"
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
        />
        <SearchIcon width={18} height={18} color={INCHAT_MUTED} />
      </div>
    </div>
  );
}
