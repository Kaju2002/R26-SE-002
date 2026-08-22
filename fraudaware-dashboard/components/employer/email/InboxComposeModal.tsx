'use client';

import { FormEvent, useState } from 'react';
import TemplateInsertControl from '@/components/employer/TemplateInsertControl';
import { sendApplicantEmail } from '@/lib/api/emailApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type Props = {
  title?: string;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  companyName?: string;
  onClose: () => void;
  onSent: () => void;
};

export default function InboxComposeModal({
  title = 'Compose email',
  initialTo = '',
  initialSubject = '',
  initialBody = '',
  companyName,
  onClose,
  onSent,
}: Props) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const token = getStoredToken();
    if (!token) return;

    setSending(true);
    setError(null);
    try {
      await sendApplicantEmail(token, {
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      onSent();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not send email.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3
            className="text-lg font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {title}
          </h3>
          <TemplateInsertControl
            variables={{ company: companyName }}
            onApply={({ subject: nextSubject, body: nextBody }) => {
              if (nextSubject.trim()) setSubject(nextSubject);
              setBody(nextBody);
            }}
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600" style={{ fontFamily: 'var(--font-poppins)' }}>
            {error}
          </p>
        ) : null}

        <label className="mt-4 block">
          <span
            className="mb-2 block text-sm font-medium"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            To
          </span>
          <input
            required
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#E5E7EE] px-3 text-sm outline-none focus:border-[#202871]"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          />
        </label>

        <label className="mt-4 block">
          <span
            className="mb-2 block text-sm font-medium"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Subject
          </span>
          <input
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#E5E7EE] px-3 text-sm outline-none focus:border-[#202871]"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          />
        </label>

        <label className="mt-4 block">
          <span
            className="mb-2 block text-sm font-medium"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Message
          </span>
          <textarea
            required
            rows={8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          />
        </label>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-medium"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-[#202871] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {sending ? 'Sending...' : 'Send email'}
          </button>
        </div>
      </form>
    </div>
  );
}
