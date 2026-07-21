'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import EmailComposeModal from '@/components/employer/EmailComposeModal';
import EmployerShell from '@/components/employer/EmployerShell';
import { createChatConversation } from '@/lib/api/chatApi';
import { getEmailConnectUrl, getEmailStatus } from '@/lib/api/emailApi';
import {
  listJobApplications,
  listMyJobs,
  updateApplicationStatus,
  type JobApplication,
  type JobSummary,
} from '@/lib/api/jobApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const STATUS_OPTIONS = ['pending', 'accepted', 'rejected'] as const;

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

export default function EmployerApplicantsPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const router = useRouter();
  const basePath = portalConfigs[portal].basePath;
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<JobApplication | null>(null);
  const [emailConnected, setEmailConnected] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      queueMicrotask(() => {
        setError('Your session has expired. Please sign in again.');
        setLoadingJobs(false);
      });
      return;
    }

    Promise.all([listMyJobs(token, { limit: 50 }), getEmailStatus(token).catch(() => null)])
      .then(([result, status]) => {
        setJobs(result.jobs);
        if (result.jobs.length > 0) setSelectedJobId(result.jobs[0].id);
        if (status) setEmailConnected(status.connected);
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

  const selectedJob = jobs.find((job) => job.id === selectedJobId);

  const startChat = useCallback(
    async (application: JobApplication) => {
      const token = getStoredToken();
      if (!token || messagingId) return;

      setMessagingId(application.id);
      setError(null);

      try {
        const conversation = await createChatConversation(token, application.id);
        router.push(`${basePath}/inchat?thread=${conversation.id}`);
      } catch (requestError: unknown) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not start the conversation.'
        );
        setMessagingId(null);
      }
    },
    [basePath, messagingId, router]
  );

  const connectMailbox = async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const returnTo = `${window.location.origin}${basePath}/email/callback`;
      const authUrl = await getEmailConnectUrl(token, 'google', returnTo);
      window.location.href = authUrl;
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not start mailbox connection.'
      );
    }
  };

  const handleStatusChange = async (applicationId: string, status: string) => {
    const token = getStoredToken();
    if (!token) return;
    try {
      await updateApplicationStatus(token, applicationId, status);
      setApplications((prev) =>
        prev.map((item) => (item.id === applicationId ? { ...item, status } : item))
      );
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update application status.'
      );
    }
  };

  return (
    <EmployerShell portal={portal}>
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
            Review applications for your jobs, update status, message in InChat, or email
            from your connected mailbox.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: emailConnected ? '#E8F5E9' : '#FFF3E0',
                color: emailConnected ? '#2E7D32' : '#EF6C00',
                fontFamily: 'var(--font-poppins)',
              }}
            >
              {emailConnected ? 'Mailbox connected' : 'Mailbox not connected'}
            </span>
            {!emailConnected ? (
              <button
                type="button"
                onClick={() => void connectMailbox()}
                className="rounded-xl border border-[#E5E7EE] px-3 py-1.5 text-xs font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Connect Gmail / Outlook
              </button>
            ) : null}
          </div>

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

        {info ? (
          <div
            className="rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {info}
          </div>
        ) : null}

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
                    className="flex flex-col gap-4 px-5 py-4 md:px-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
                          <span
                            className="text-sm font-bold"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {initialsFromName(application.fullName)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p
                            className="truncate text-sm font-semibold"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {application.fullName}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {application.email}
                          </p>
                          <p
                            className="mt-1 text-xs font-medium"
                            style={{
                              color: colors.body,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            Applied {formatAppliedAt(application.appliedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={application.status}
                          onChange={(event) => {
                            if (event.target.value === 'sent') return;
                            void handleStatusChange(application.id, event.target.value);
                          }}
                          className="rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2 text-xs font-semibold outline-none"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {application.status === 'sent' ? (
                            <option value="sent">sent</option>
                          ) : null}
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setEmailTarget(application)}
                          className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          Email
                        </button>
                        <button
                          type="button"
                          onClick={() => void startChat(application)}
                          disabled={Boolean(messagingId)}
                          className="rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1A2160] disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ fontFamily: 'var(--font-poppins)' }}
                        >
                          {busy ? 'Opening chat...' : 'Message'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {emailTarget ? (
        <EmailComposeModal
          to={emailTarget.email}
          applicantName={emailTarget.fullName}
          applicationId={emailTarget.id}
          jobTitle={selectedJob?.title}
          onClose={() => setEmailTarget(null)}
          onSent={() => {
            setEmailTarget(null);
            setInfo(`Email sent to ${emailTarget.fullName}.`);
          }}
          onNeedConnect={() => {
            setEmailTarget(null);
            void connectMailbox();
          }}
        />
      ) : null}
    </EmployerShell>
  );
}
