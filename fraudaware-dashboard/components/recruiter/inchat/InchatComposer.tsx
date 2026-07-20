'use client';

import { useCallback, useState } from 'react';
import {
  MicrophoneIcon,
  PaperclipIcon,
  SendIcon,
  XIcon,
} from '@/components/recruiter/inchat/InchatIcons';
import { INCHAT_BORDER } from '@/lib/inchat/inchatStyles';

const MAX_CHARS = 2000;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
};

export default function InchatComposer({
  value,
  onChange,
  onSend,
  sending,
  disabled = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const trimmedLen = value.trim().length;
  const sendDisabled = disabled || sending || trimmedLen === 0;
  const showSend = !disabled && trimmedLen > 0;

  const handleSend = useCallback(() => {
    if (!sendDisabled) {
      setMenuOpen(false);
      onSend();
    }
  }, [onSend, sendDisabled]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-white px-3 pb-3 pt-2" style={{ borderColor: INCHAT_BORDER }}>
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          disabled={disabled}
          className="mb-0.5 flex h-11 w-10 items-center justify-center text-[#5F6368] disabled:opacity-50"
          aria-label={menuOpen ? 'Close attachment menu' : 'Attachments'}
        >
          {menuOpen ? <XIcon /> : <PaperclipIcon />}
        </button>

        <textarea
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value.length <= MAX_CHARS
                ? event.target.value
                : event.target.value.slice(0, MAX_CHARS)
            )
          }
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'You blocked this conversation' : 'Write a message…'}
          rows={1}
          disabled={sending || disabled}
          className="scrollbar-hide max-h-[120px] min-h-[44px] flex-1 resize-none overflow-y-auto rounded-[22px] bg-[#F0F2F5] px-4 py-2.5 text-base font-medium text-[#111827] outline-none disabled:opacity-70"
          style={{ fontFamily: 'var(--font-poppins)' }}
        />

        {showSend ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={sendDisabled}
            className="mb-0.5 flex h-11 w-10 items-center justify-center text-[#2563EB] disabled:opacity-50"
            aria-label="Send message"
          >
            {sending ? '…' : <SendIcon />}
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => alert('Voice messages will be available when chat service is connected.')}
            className="mb-0.5 flex h-11 w-10 items-center justify-center text-[#5F6368] disabled:opacity-50"
            aria-label="Record voice message"
          >
            <MicrophoneIcon />
          </button>
        )}
      </div>

      {menuOpen && !disabled ? (
        <div className="mt-3 space-y-1 pb-1">
          {[
            'Send a document',
            'Attach photo or video',
            'Select media from library',
            'Send a GIF',
          ].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setMenuOpen(false);
                alert(`${label} will be available when chat service is connected.`);
              }}
              className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left text-base font-medium text-[#1F2937] hover:bg-[#F3F5F9]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              <span className="text-[#5F6368]">+</span>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
