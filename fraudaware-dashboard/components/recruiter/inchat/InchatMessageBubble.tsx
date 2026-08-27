'use client';

import type { InchatMessage } from '@/lib/inchat/types';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import InchatVoicePlayer from '@/components/recruiter/inchat/InchatVoicePlayer';

type Props = {
  message: InchatMessage;
  participantName?: string;
  participantInitials?: string;
  participantAvatarUrl?: string;
  selfAvatarUrl?: string;
  selfInitials?: string;
};

type ReceiptStatus = 'sent' | 'delivered' | 'read';

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayFileName(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Document';
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

function receiptStatus(message: InchatMessage, mine: boolean): ReceiptStatus | null {
  if (!mine || message.unsent) return null;
  if (message.status === 'delivered' || message.status === 'read' || message.status === 'sent') {
    return message.status;
  }
  return 'sent';
}

function ReceiptTicks({ status }: { status: ReceiptStatus }) {
  const color = status === 'read' ? '#53BDEB' : '#667781';
  const label =
    status === 'sent' ? 'Message sent' : status === 'read' ? 'Message read' : 'Message delivered';

  return (
    <span
      aria-label={label}
      className="ml-1.5 inline-flex items-center"
      style={{ color }}
    >
      {status === 'sent' ? (
        <CheckIcon />
      ) : (
        <>
          <CheckIcon />
          <span style={{ marginLeft: -3, display: 'inline-flex' }}>
            <CheckIcon />
          </span>
        </>
      )}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="9" viewBox="0 0 12 10" fill="none" aria-hidden>
      <path
        d="M1 5L4.2 8.2L11 1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SideAvatar({ url, initials }: { url?: string; initials: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="mt-5 h-8 w-8 shrink-0 rounded-full object-cover"
      style={{ backgroundColor: '#E3E6F5' }}
    />
  ) : (
    <div className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E3E6F5]">
      <span
        className="text-[10px] font-bold"
        style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
      >
        {initials}
      </span>
    </div>
  );
}

export default function InchatMessageBubble({
  message,
  participantName = 'Applicant',
  participantInitials = 'A',
  participantAvatarUrl,
  selfAvatarUrl,
  selfInitials = 'ME',
}: Props) {
  const mine = message.role === 'recruiter';
  const isUnsent = message.unsent === true;
  const status = receiptStatus(message, mine);
  const imageAttachment =
    message.messageType === 'image'
      ? message.attachments?.find((attachment) => attachment.url)
      : undefined;
  const fileAttachment =
    message.messageType === 'file'
      ? message.attachments?.find((attachment) => attachment.url)
      : undefined;
  const audioAttachment =
    message.messageType === 'audio'
      ? message.attachments?.find((attachment) => attachment.url)
      : undefined;
  const compactMeta =
    !imageAttachment &&
    !fileAttachment &&
    !audioAttachment &&
    message.body.length <= 28 &&
    !message.body.includes('\n');
  // Recruiter portal: never show scam badges (warnings are for jobseekers on mobile).
  const isFlagged = false;
  const voiceAvatarUrl = mine ? selfAvatarUrl : participantAvatarUrl;
  const voiceInitials = mine ? selfInitials : participantInitials;

  return (
    <div className={`mb-4 flex max-w-[88%] gap-2.5 ${mine ? 'ml-auto justify-end' : 'mr-auto'}`}>
      {!mine ? (
        <SideAvatar url={participantAvatarUrl} initials={participantInitials} />
      ) : null}

      <div className={mine ? 'text-right' : 'text-left'}>
        <p
          className="mb-1 text-[11px] font-medium"
          style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
        >
          {mine ? 'You' : participantName}
        </p>
        <div
          className={`inline-block max-w-full rounded-md text-left ${
            isFlagged
              ? 'border border-red-300 bg-red-50 px-3 pb-1.5 pt-2'
              : audioAttachment
                ? mine
                  ? 'bg-[#EEF0F8] px-2.5 pb-1 pt-1.5'
                  : 'border bg-[#F3F5F8] px-2.5 pb-1 pt-1.5'
                : mine
                  ? 'bg-[#EEF0F8] px-3 pb-1.5 pt-2'
                  : 'border bg-[#F3F5F8] px-3 pb-1.5 pt-2'
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
          {imageAttachment ? (
            <a
              href={imageAttachment.url}
              target="_blank"
              rel="noreferrer"
              className="mb-1 block"
              aria-label={`Open ${imageAttachment.fileName || 'chat image'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageAttachment.url}
                alt={imageAttachment.fileName || 'Chat image'}
                className="h-48 w-64 max-w-full rounded-md bg-[#E5E7EB] object-cover"
              />
            </a>
          ) : null}
          {audioAttachment ? (
            <InchatVoicePlayer
              url={audioAttachment.url}
              durationMs={audioAttachment.durationMs}
              mine={mine}
              avatarUrl={voiceAvatarUrl}
              initials={voiceInitials}
            />
          ) : null}
          {fileAttachment ? (
            <a
              href={fileAttachment.url}
              target="_blank"
              rel="noreferrer"
              className="mb-1 flex w-64 max-w-full items-center gap-2.5 rounded-lg bg-white/90 px-3 py-2.5 text-left no-underline"
              aria-label={`Open ${displayFileName(fileAttachment.fileName)}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8EAF6] text-xl">
                📄
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-xs font-bold text-[#1F2937]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {displayFileName(fileAttachment.fileName)}
                </span>
                <span
                  className="mt-0.5 block text-[10px] font-semibold text-[#667085]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {displayFileName(fileAttachment.fileName).split('.').pop()?.toUpperCase() ||
                    'DOCUMENT'}
                  {fileAttachment.size ? ` · ${formatFileSize(fileAttachment.size)}` : ''}
                </span>
              </span>
              <span className="text-sm text-[#202871]" aria-hidden>
                ↗
              </span>
            </a>
          ) : null}
          {compactMeta ? (
            <div className="flex items-end gap-2">
              <p
                className={`min-w-0 shrink text-sm leading-5 text-[#1F2937] ${
                  isUnsent ? 'italic opacity-80' : ''
                }`}
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {message.body}
              </p>
              <div className="flex shrink-0 items-center justify-end pb-0.5">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
                >
                  {message.timeLabel}
                </span>
                {status ? <ReceiptTicks status={status} /> : null}
              </div>
            </div>
          ) : message.body ? (
            <p
              className={`text-sm leading-5 text-[#1F2937] ${isUnsent ? 'italic opacity-80' : ''}`}
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message.body}
            </p>
          ) : null}
          {isFlagged && message.scamAnalysis?.tactics.length ? (
            <p className="mt-2 text-[11px] font-medium text-red-600">
              Detected: {message.scamAnalysis.tactics.join(', ')}
            </p>
          ) : null}
          {!compactMeta ? (
            <div className="mt-0.5 flex items-center justify-end">
              <span
                className="text-[11px] font-semibold"
                style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
              >
                {message.timeLabel}
              </span>
              {status ? <ReceiptTicks status={status} /> : null}
            </div>
          ) : null}
        </div>
      </div>

      {mine ? <SideAvatar url={selfAvatarUrl} initials={selfInitials} /> : null}
    </div>
  );
}
