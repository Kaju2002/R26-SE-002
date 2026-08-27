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
  onAttachAudio?: (file: File, durationMs: number) => Promise<void> | void;
  sending?: boolean;
  disabled?: boolean;
  templateVariables?: TemplateVariables;
};

function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function InchatComposer({
  value,
  onChange,
  onSend,
  onAttachImage,
  onAttachDocument,
  onAttachAudio,
  sending,
  disabled = false,
  templateVariables,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startVoice = useCallback(async () => {
    if (disabled || attachBusy || !onAttachAudio || mediaRecorderRef.current) return;
    setAttachError(null);
    setMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const durationMs = Date.now() - startedAtRef.current;
        stopTicker();
        setRecording(false);
        setElapsedMs(0);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        if (durationMs < 700) {
          setAttachError('Hold the mic a bit longer to record.');
          return;
        }
        const extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${extension}`, {
          type: blob.type || 'audio/webm',
        });
        void Promise.resolve(onAttachAudio(file, durationMs)).catch((error: unknown) => {
          setAttachError(
            error instanceof Error ? error.message : 'Could not send voice message.'
          );
        });
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      recorder.start();
      stopTicker();
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
    } catch {
      setAttachError('Microphone permission is required for voice messages.');
    }
  }, [attachBusy, disabled, onAttachAudio, stopTicker]);

  const stopVoice = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

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

      {recording ? (
        <p
          className="mb-2 text-xs font-semibold text-[#E53935]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Recording {formatMmSs(elapsedMs)} — release to send
        </p>
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
          disabled={disabled || attachBusy || recording}
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
          placeholder={
            disabled
              ? 'You blocked this conversation'
              : recording
                ? 'Recording…'
                : 'Write a message…'
          }
          rows={1}
          disabled={sending || disabled || recording}
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
            disabled={disabled || attachBusy || !onAttachAudio}
            onMouseDown={(event) => {
              event.preventDefault();
              void startVoice();
            }}
            onMouseUp={() => stopVoice()}
            onMouseLeave={() => {
              if (recording) stopVoice();
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              void startVoice();
            }}
            onTouchEnd={() => stopVoice()}
            className={`mb-0.5 flex h-11 w-10 items-center justify-center rounded-full disabled:opacity-50 ${
              recording ? 'bg-[#E53935] text-white' : 'text-[#5F6368]'
            }`}
            aria-label="Hold to record voice message"
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
