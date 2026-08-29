'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createInterview,
  type CreateInterviewPayload,
  type InterviewType,
} from '@/lib/api/interviewApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type CandidateOption = {
  applicationId: string;
  fullName: string;
  email: string;
  jobTitle: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onScheduled: (message: string) => void;
  /** Prefill a single applicant (from Applicants page). */
  candidate?: CandidateOption | null;
  /** Optional list when scheduling from Interviews page. */
  candidates?: CandidateOption[];
  /** Prefill start from calendar slot click */
  initialStartsAt?: Date | null;
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInputValue(d);
}

function defaultEnd(startLocal: string): string {
  const d = new Date(startLocal);
  if (Number.isNaN(d.getTime())) return defaultStart();
  d.setHours(d.getHours() + 1);
  return toLocalInputValue(d);
}

export default function ScheduleInterviewModal({
  open,
  onClose,
  onScheduled,
  candidate,
  candidates = [],
  initialStartsAt = null,
}: Props) {
  const options = useMemo(() => {
    if (candidate) return [candidate];
    return candidates;
  }, [candidate, candidates]);

  const [applicationId, setApplicationId] = useState(
    candidate?.applicationId || options[0]?.applicationId || ''
  );
  const [startsLocal, setStartsLocal] = useState(() =>
    initialStartsAt ? toLocalInputValue(initialStartsAt) : defaultStart()
  );
  const [endsLocal, setEndsLocal] = useState(() =>
    defaultEnd(initialStartsAt ? toLocalInputValue(initialStartsAt) : defaultStart())
  );
  const [type, setType] = useState<InterviewType>('video');
  const [provider, setProvider] = useState<'google_meet' | 'microsoft_teams' | 'none'>(
    'google_meet'
  );
  const [location, setLocation] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [sendInvite, setSendInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (candidate?.applicationId) setApplicationId(candidate.applicationId);
    else if (options[0]?.applicationId) setApplicationId(options[0].applicationId);
    if (initialStartsAt) {
      const start = toLocalInputValue(initialStartsAt);
      setStartsLocal(start);
      setEndsLocal(defaultEnd(start));
    }
  }, [open, candidate, options, initialStartsAt]);

  const calendarWillInviteCandidate =
    type === 'video' && provider !== 'none';
  const minScheduleLocal = toLocalInputValue(new Date());

  useEffect(() => {
    if (!open) return;
    if (calendarWillInviteCandidate) {
      setSendInvite(false);
    }
  }, [open, calendarWillInviteCandidate]);

  if (!open) return null;

  const selected =
    options.find((c) => c.applicationId === applicationId) || options[0] || null;

  const handleSubmit = async () => {
    setError(null);
    const token = getStoredToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    if (!applicationId) {
      setError('Select a candidate.');
      return;
    }

    const startsAt = new Date(startsLocal);
    const endsAt = new Date(endsLocal);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setError('Enter a valid date and time.');
      return;
    }
    if (endsAt <= startsAt) {
      setError('End time must be after start time.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      setError('Interview start time cannot be in the past.');
      return;
    }

    const payload: CreateInterviewPayload = {
      applicationId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      type,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      conferenceUrl: manualUrl.trim() || undefined,
      conferencingProvider: type === 'video' ? provider : 'none',
      addConferencing: type === 'video' && provider !== 'none',
      sendInvite,
    };

    setBusy(true);
    try {
      const result = await createInterview(token, payload);
      const warn =
        result.warnings.length > 0 ? ` (${result.warnings.join('; ')})` : '';
      onScheduled(
        `Interview scheduled with ${result.interview.candidateName}${warn}`
      );
      onClose();
    } catch (requestError: unknown) {
      const err = requestError as Error & { code?: string };
      if (err.code === 'INTERVIEW_ALREADY_EXISTS') {
        setError(
          err.message ||
            'An interview is already scheduled for this applicant. Open Interviews to reschedule.'
        );
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not schedule interview.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        className="w-full max-w-lg rounded-2xl border border-[#EEF0F8] bg-white shadow-xl"
        style={{ fontFamily: 'var(--font-poppins)' }}
      >
        <div className="flex items-center justify-between border-b border-[#EEF0F8] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
              Schedule interview
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: colors.muted }}>
              Creates a calendar event with Meet/Teams when mailbox is connected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[#858BBD] hover:bg-[#F7F8FE]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-3 py-2 text-sm text-[#C62828]">
              {error}
            </div>
          ) : null}

          {options.length > 1 ? (
            <label className="block">
              <span className="text-xs font-medium" style={{ color: colors.muted }}>
                Candidate
              </span>
              <select
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
                style={{ color: colors.navy }}
              >
                {options.map((c) => (
                  <option key={c.applicationId} value={c.applicationId}>
                    {c.fullName} — {c.jobTitle}
                  </option>
                ))}
              </select>
            </label>
          ) : selected ? (
            <div className="rounded-xl bg-[#F7F8FE] px-3 py-3">
              <p className="text-sm font-medium" style={{ color: colors.navy }}>
                {selected.fullName}
              </p>
              <p className="text-xs" style={{ color: colors.muted }}>
                {selected.jobTitle} · {selected.email}
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: colors.muted }}>
              No shortlisted / interview candidates available.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium" style={{ color: colors.muted }}>
                Starts
              </span>
              <input
                type="datetime-local"
                value={startsLocal}
                min={minScheduleLocal}
                onChange={(e) => {
                  setStartsLocal(e.target.value);
                  setEndsLocal(defaultEnd(e.target.value));
                }}
                className="mt-1 w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium" style={{ color: colors.muted }}>
                Ends
              </span>
              <input
                type="datetime-local"
                value={endsLocal}
                min={startsLocal || minScheduleLocal}
                onChange={(e) => setEndsLocal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium" style={{ color: colors.muted }}>
              Interview type
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {(['video', 'phone', 'onsite'] as InterviewType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                    type === value
                      ? 'bg-[#202871] text-white'
                      : 'bg-[#F7F8FE] text-[#42498A]'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </label>

          {type === 'video' ? (
            <label className="block">
              <span className="text-xs font-medium" style={{ color: colors.muted }}>
                Video provider
              </span>
              <select
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as 'google_meet' | 'microsoft_teams' | 'none')
                }
                className="mt-1 w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              >
                <option value="google_meet">Google Meet (auto via calendar)</option>
                <option value="microsoft_teams">Microsoft Teams (auto via calendar)</option>
                <option value="none">Manual link only</option>
              </select>
              <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="Optional paste Meet/Teams/Zoom URL"
                  className="mt-2 w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
                />
            </label>
          ) : null}

          {type === 'onsite' || type === 'phone' ? (
            <label className="block">
              <span className="text-xs font-medium" style={{ color: colors.muted }}>
                {type === 'phone' ? 'Phone number' : 'Location'}
              </span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
                placeholder={type === 'phone' ? '+94 …' : 'Office address / room'}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-medium" style={{ color: colors.muted }}>
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              placeholder="Agenda, interviewers, prep…"
            />
          </label>

          <label
            className={`flex items-start gap-2 text-sm ${calendarWillInviteCandidate ? 'opacity-70' : ''}`}
            style={{ color: colors.body }}
          >
            <input
              type="checkbox"
              checked={sendInvite}
              onChange={(e) => setSendInvite(e.target.checked)}
              disabled={calendarWillInviteCandidate}
              className="mt-0.5 rounded border-[#D1D5DB] disabled:cursor-not-allowed"
            />
            <span>
              Send separate invite email
              {calendarWillInviteCandidate ? (
                <span className="mt-0.5 block text-xs" style={{ color: colors.muted }}>
                  Not needed — the calendar invite with Meet link is sent automatically.
                </span>
              ) : (
                <span className="mt-0.5 block text-xs" style={{ color: colors.muted }}>
                  Use when no calendar mailbox is connected.
                </span>
              )}
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#EEF0F8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-medium"
            style={{ color: colors.navy }}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !applicationId}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: colors.navy }}
          >
            {busy ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
