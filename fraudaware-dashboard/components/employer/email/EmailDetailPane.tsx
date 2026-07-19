'use client';

import type { EmailMessageDetail } from '@/lib/api/emailApi';
import { colors } from '@/lib/theme/colors';
import {
  formatFileSize,
  formatRelativeTime,
  participantLabel,
} from './emailFormat';

type Props = {
  message: EmailMessageDetail | null;
  loading: boolean;
  onReply: () => void;
  onForward: () => void;
};

export default function EmailDetailPane({
  message,
  loading,
  onReply,
  onForward,
}: Props) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <p style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}>
          Loading message...
        </p>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
        <p
          className="text-base font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Select a message
        </p>
        <p
          className="mt-2 max-w-sm text-sm"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          Choose an email from the list to read it here.
        </p>
      </div>
    );
  }

  const fromLabel = participantLabel(message.from);
  const fromEmail = message.from[0]?.email;
  const initials = fromLabel
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full min-w-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-[#EEF0F8] px-5 py-3">
        <button
          type="button"
          onClick={onReply}
          className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-medium text-[#202871] hover:bg-[#F7F8FE]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Reply
        </button>
        <button
          type="button"
          onClick={onForward}
          className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-medium text-[#202871] hover:bg-[#F7F8FE]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Forward
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
            <span
              className="text-xs font-bold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {initials || '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  {fromLabel}
                </p>
                {fromEmail ? (
                  <p
                    className="text-xs"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    {fromEmail}
                  </p>
                ) : null}
              </div>
              <span
                className="text-xs"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                {formatRelativeTime(message.date)}
              </span>
            </div>
          </div>
        </div>

        <h2
          className="mt-5 text-xl font-semibold leading-snug"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {message.subject}
        </h2>

        <div
          className="email-body mt-5 text-sm leading-relaxed [&_a]:text-[#202871] [&_a]:underline [&_img]:max-w-full [&_p]:mb-3"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          dangerouslySetInnerHTML={{ __html: message.body || message.snippet || '' }}
        />

        {message.attachments.length > 0 ? (
          <div className="mt-8 border-t border-[#EEF0F8] pt-5">
            <p
              className="mb-3 text-sm font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Attachments ({message.attachments.length})
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {message.attachments.map((attachment, index) => (
                <div
                  key={attachment.id || `${attachment.filename}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-3 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-[#202871]">
                    FILE
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                    >
                      {attachment.filename}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                    >
                      {formatFileSize(attachment.size) ||
                        attachment.contentType ||
                        'Attachment'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-3 border-t border-[#EEF0F8] px-6 py-4">
        <button
          type="button"
          onClick={onReply}
          className="rounded-xl border border-[#202871] px-5 py-2 text-sm font-semibold text-[#202871] hover:bg-[#F7F8FE]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Reply
        </button>
        <button
          type="button"
          onClick={onForward}
          className="rounded-xl border border-[#E5E7EE] px-5 py-2 text-sm font-semibold text-[#202871] hover:bg-[#F7F8FE]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Forward
        </button>
      </div>
    </div>
  );
}
