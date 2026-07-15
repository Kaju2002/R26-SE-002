'use client';

import { INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';

export default function InchatEmptyState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#FAFBFE] px-8 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#EEF0F8] bg-white text-2xl shadow-sm"
        aria-hidden
      >
        💬
      </div>
      <h2
        className="text-lg font-semibold"
        style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
      >
        Select a conversation
      </h2>
      <p
        className="mt-2 max-w-sm text-sm leading-relaxed"
        style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
      >
        Choose an applicant from the list to view messages and reply in real time.
      </p>
    </div>
  );
}
