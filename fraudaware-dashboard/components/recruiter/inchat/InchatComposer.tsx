'use client';

import { useCallback, useRef, useState } from 'react';
import TemplateInsertControl from '@/components/employer/TemplateInsertControl';
import {
  MicrophoneIcon,
  PaperclipIcon,
  SendIcon,
  XIcon,
} from '@/components/recruiter/inchat/InchatIcons';
import type { TemplateVariables } from '@/lib/api/templateApi';
import { INCHAT_BORDER } from '@/lib/inchat/inchatStyles';

const MAX_CHARS = 2000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAttachImage?: (file: File) => Promise<void> | void;
  onAttachDocument?: (file: File) => Promise<void> | void;
  sending?: boolean;
  disabled?: boolean;
  templateVariables?: TemplateVariables;
};

export default function InchatComposer({
  value,
  onChange,
  onSend,
  onAttachImage,
  onAttachDocument,
  sending,
  disabled = false,
  templateVariables,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const trimmedLen = value.trim().length;
  const sendDisabled = disabled || sending || trimmedLen === 0;
  const showSend = !disabled && trimmedLen > 0;
  const attachBusy = Boolean(sending);

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

  const pickImage = useCallback(() => {
    setAttachError(null);
    setMenuOpen(false);
    imageInputRef.current?.click();
  }, []);

  const pickDocument = useCallback(() => {
    setAttachError(null);
    setMenuOpen(false);
    documentInputRef.current?.click();
  }, []);

  const onImageSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !onAttachImage) return;
      if (!file.type.startsWith('image/')) {
        setAttachError('Choose a JPG, PNG, GIF, or WebP image.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setAttachError('Images cannot exceed 5 MB.');
        return;
      }
      try {
        await onAttachImage(file);
      } catch (error) {
        setAttachError(error instanceof Error ? error.message : 'Could not send image.');
      }
    },
    [onAttachImage]
  );

  const onDocumentSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !onAttachDocument) return;
      const name = file.name.toLowerCase();
      const okExt =
        name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx');
      if (!okExt) {
        setAttachError('Use PDF, DOC, or DOCX only.');
        return;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        setAttachError('Documents cannot exceed 10 MB.');
        return;
      }
      try {
        await onAttachDocument(file);
      } catch (error) {
        setAttachError(error instanceof Error ? error.message : 'Could not send document.');
      }
    },
    [onAttachDocument]
  );

  return (
    <div className="border-t bg-white px-3 pb-3 pt-2" style={{ borderColor: INCHAT_BORDER }}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(event) => void onImageSelected(event)}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => void onDocumentSelected(event)}
      />

      {!disabled ? (
        <div className="mb-2 flex justify-end">
          <TemplateInsertControl
            bodyOnly
            variables={templateVariables}
            onApply={({ body }) => {
              const next = body.length <= MAX_CHARS ? body : body.slice(0, MAX_CHARS);
              onChange(next);
            }}
          />
        </div>
      ) : null}

      {attachError ? (
        <p
          className="mb-2 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs font-semibold text-[#B42318]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          {attachError}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          disabled={disabled || attachBusy}
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
            onClick={() =>
              alert('Voice messages are not available yet. Use text, photo, or document.')
            }
            className="mb-0.5 flex h-11 w-10 items-center justify-center text-[#5F6368] disabled:opacity-50"
            aria-label="Record voice message"
          >
            <MicrophoneIcon />
          </button>
        )}
      </div>

      {menuOpen && !disabled ? (
        <div className="mt-3 space-y-1 pb-1">
          <button
            type="button"
            onClick={pickDocument}
            disabled={attachBusy || !onAttachDocument}
            className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left text-base font-medium text-[#1F2937] hover:bg-[#F3F5F9] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            <span className="text-[#5F6368]">+</span>
            Send a document
          </button>
          <button
            type="button"
            onClick={pickImage}
            disabled={attachBusy || !onAttachImage}
            className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left text-base font-medium text-[#1F2937] hover:bg-[#F3F5F9] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            <span className="text-[#5F6368]">+</span>
            Attach photo
          </button>
          <button
            type="button"
            onClick={pickImage}
            disabled={attachBusy || !onAttachImage}
            className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left text-base font-medium text-[#1F2937] hover:bg-[#F3F5F9] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            <span className="text-[#5F6368]">+</span>
            Select media from library
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              alert('GIF search is not available yet.');
            }}
            className="flex w-full items-center gap-4 rounded-lg px-1 py-3 text-left text-base font-medium text-[#1F2937] hover:bg-[#F3F5F9]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            <span className="text-[#5F6368]">+</span>
            Send a GIF
          </button>
        </div>
      ) : null}
    </div>
  );
}
