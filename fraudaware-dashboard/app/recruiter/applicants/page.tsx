'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import RecruiterShell from '@/components/recruiter/RecruiterShell';
import { createChatConversation } from '@/lib/api/chatApi';
import {
  listJobApplications,
  listMyJobs,
  type JobApplication,
  type JobSummary,
} from '@/lib/api/jobApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'A';
}

function formatAppliedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RecruiterApplicantsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      queueMicrotask(() => {
        setError('Your session has expired. Please sign in again.');
        setLoadingJobs(false);
      });
      return;
    }

    listMyJobs(token)
      .then((items) => {
        setJobs(items);
        if (items.length > 0) {
          setSelectedJobId(items[0].id);
        }
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error ? requestError.message : 'Could not load your jobs.'
        );
      })
      .finally(() => setLoadingJobs(false));
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      queueMicrotask(() => setApplications([]));
      return;
    }

    const token = getStoredToken();
    if (!token) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingApplications(true);
      setError(null);
    });

    listJobApplications(token, selectedJobId)
      .then((items) => {
        if (!cancelled) setApplications(items);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setApplications([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load applications for this job.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingApplications(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  const startChat = useCallback(
    async (application: JobApplication) => {
      const token = getStoredToken();
      if (!token || messagingId) return;

      setMessagingId(application.id);
      setError(null);

      try {
        const conversation = await createChatConversation(token, application.id);
        router.push(`/recruiter/inchat?thread=${conversation.id}`);
      } catch (requestError: unknown) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not start the conversation.'
        );
        setMessagingId(null);
      }
    },
    [messagingId, router]
  );

  return (
    <RecruiterShell>
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm md:p-8">
          <h2
            className="text-xl font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Applicants
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Select a job, review applications, and message an applicant in InChat.
          </p>

          <label className="mt-5 block">
            <span
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Job posting
            </span>
            <select
              value={selectedJobId}
              onChange={(event) => setSelectedJobId(event.target.value)}
              disabled={loadingJobs || jobs.length === 0}
              className="w-full max-w-xl rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none transition focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {jobs.length === 0 ? (
                <option value="">No jobs found</option>
              ) : (
                jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} · {job.applicants} applicants
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          {loadingJobs || loadingApplications ? (
            <p
              className="px-6 py-10 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Loading applications...
            </p>
          ) : error ? (
            <p
              className="px-6 py-10 text-center text-sm text-red-600"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </p>
          ) : applications.length === 0 ? (
            <p
              className="px-6 py-10 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              No applications for this job yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEF0F8]">
              {applications.map((application) => {
                const busy = messagingId === application.id;
                return (
                  <li
                    key={application.id}
                    className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
                        <span
                          className="text-sm font-bold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {initialsFromName(application.fullName)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {application.fullName}
                        </p>
                        <p
                          className="truncate text-xs"
                          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                        >
                          {application.email}
                        </p>
                        <p
                          className="mt-1 text-xs font-medium"
                          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                        >
                          {application.status} · Applied {formatAppliedAt(application.appliedAt)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void startChat(application)}
                      disabled={Boolean(messagingId)}
                      className="shrink-0 rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1A2160] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ fontFamily: 'var(--font-poppins)' }}
                    >
                      {busy ? 'Opening chat...' : 'Message'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </RecruiterShell>
  );
}
