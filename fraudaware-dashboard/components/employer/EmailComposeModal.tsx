'use client';

import { FormEvent, useState } from 'react';
import { sendApplicantEmail } from '@/lib/api/emailApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type Props = {
  to: string;
  applicantName: string;
  applicationId: string;
  jobTitle?: string;
  onClose: () => void;
  onSent: () => void;
  onNeedConnect: () => void;
};

export default function EmailComposeModal({
  to,
  applicantName,
  applicationId,
  jobTitle,
  onClose,
  onSent,
  onNeedConnect,
}: Props) {
  const [subject, setSubject] = useState(
    jobTitle ? `Regarding your application for ${jobTitle}` : 'Regarding your application'
  );
  const [body, setBody] = useState(
    `Hi ${applicantName},\n\nThank you for applying. We would like to follow up on your application.\n\nBest regards`
  );
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
        to,
        subject: subject.trim(),
        body: body.trim(),
        applicationId,
      });
      onSent();
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error ? requestError.message : 'Could not send email.';
      if (/not connected|connect/i.test(message)) {
        onNeedConnect();
        return;
      }
      setError(message);
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
        <h3
          className="text-lg font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Email applicant
        </h3>
        <p
          className="mt-1 text-sm"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          To: {to}
        </p>

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
