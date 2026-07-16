'use client';

import type { InchatMessage } from '@/lib/inchat/types';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';

type Props = {
  message: InchatMessage;
  participantName?: string;
  participantInitials?: string;
};

export default function InchatMessageBubble({
  message,
  participantName = 'Applicant',
  participantInitials = 'A',
}: Props) {
  const mine = message.role === 'recruiter';
  const isUnsent = message.unsent === true;
  // Recruiter portal: never show scam badges (warnings are for jobseekers on mobile).
  const isFlagged = false;

  return (
    <div className={`mb-4 flex max-w-[88%] gap-2.5 ${mine ? 'ml-auto justify-end' : 'mr-auto'}`}>
      {!mine ? (
        <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E3E6F5]">
          <span
            className="text-[10px] font-bold"
            style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
          >
            {participantInitials}
          </span>
        </div>
      ) : null}

      <div className={mine ? 'text-right' : 'text-left'}>
        <p
          className="mb-1 text-[11px] font-medium"
          style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
        >
          {mine ? `You, ${message.timeLabel}` : `${participantName}, ${message.timeLabel}`}
        </p>
        <div
          className={`inline-block max-w-full rounded-md px-3.5 py-2.5 text-left ${
            isFlagged
              ? 'border border-red-300 bg-red-50'
              : mine
                ? 'bg-[#EEF0F8]'
                : 'border bg-[#F3F5F8]'
          }`}
          style={!mine && !isFlagged ? { borderColor: INCHAT_BORDER } : undefined}
        >
          {isFlagged ? (
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-red-700">
              <span aria-hidden>⚠</span>
              Potential scam
              {message.scamAnalysis?.score !== null &&
              message.scamAnalysis?.score !== undefined
                ? ` • ${Math.round(message.scamAnalysis.score * 100)}% risk`
                : ''}
            </div>
          ) : null}
          <p
            className={`text-sm leading-5 text-[#1F2937] ${isUnsent ? 'italic opacity-80' : ''}`}
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {message.body}
          </p>
          {isFlagged && message.scamAnalysis?.tactics.length ? (
            <p className="mt-2 text-[11px] font-medium text-red-600">
              Detected: {message.scamAnalysis.tactics.join(', ')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
