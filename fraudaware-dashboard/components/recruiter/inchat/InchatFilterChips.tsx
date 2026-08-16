'use client';

import type { InchatFilterId } from '@/lib/inchat/types';

type Option = { id: InchatFilterId; label: string };

type Props = {
  options: Option[];
  activeId: InchatFilterId;
  onSelect: (id: InchatFilterId) => void;
};

export default function InchatFilterChips({ options, activeId, onSelect }: Props) {
  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto overflow-y-hidden px-4 py-3">
      {options.map((option) => {
        const active = option.id === activeId;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              active
                ? 'border-[#202871] bg-[#202871] text-white'
                : 'border-[#E5E7EB] bg-white text-[#42498A] hover:bg-[#F7F8FE]'
            }`}
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
