'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import EmailComposeModal from '@/components/employer/EmailComposeModal';
import ScheduleInterviewModal from '@/components/employer/ScheduleInterviewModal';
import { useEmployerWorkspace } from '@/components/employer/EmployerWorkspaceContext';
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

const ALL_JOBS = 'all';

/** Recruiter pipeline stages (Phase 1). */
const STATUS_OPTIONS = [
  { value: 'applied', label: 'Applied' },
  { value: 'screened', label: 'Screened' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview', label: 'Interview' },
  { value: 'offered', label: 'Offered' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
] as const;

type PipelineStatus = (typeof STATUS_OPTIONS)[number]['value'];
type StatusFilter = 'all' | PipelineStatus;

const PIPELINE_VALUES = new Set<string>(STATUS_OPTIONS.map((s) => s.value));

/** Map legacy DB values onto the Phase 1 pipeline. */
function normalizePipelineStatus(status: string): PipelineStatus {
  if (status === 'sent' || status === 'pending') return 'applied';
  if (status === 'accepted') return 'shortlisted';
  if (PIPELINE_VALUES.has(status)) return status as PipelineStatus;
  return 'applied';
}

function statusLabel(status: string): string {
  const canonical = normalizePipelineStatus(status);
  return STATUS_OPTIONS.find((s) => s.value === canonical)?.label || canonical;
}

function statusStyles(status: string): { color: string; background: string } {
  const canonical = normalizePipelineStatus(status);
  if (canonical === 'hired' || canonical === 'offered') {
    return { color: '#2E7D32', background: '#E8F5E9' };
  }
  if (canonical === 'shortlisted') return { color: '#1565C0', background: '#E3F2FD' };
  if (canonical === 'interview') return { color: '#6A1B9A', background: '#F3E5F5' };
  if (canonical === 'screened') return { color: '#EF6C00', background: '#FFF3E0' };
  if (canonical === 'rejected') return { color: '#C62828', background: '#FFEBEE' };
  return { color: '#5B6473', background: '#EEF0F8' }; // applied
}

function statusMatchesFilter(rawStatus: string, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  return normalizePipelineStatus(rawStatus) === filter;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'A';
}

function formatAppliedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function ActionIconButton({
  label,
  onClick,
  href,
  tone = 'default',
  disabled,
  children,
}: {
  label: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  href?: string;
  tone?: 'default' | 'danger' | 'success';
  disabled?: boolean;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-[#C62828] hover:bg-[#FFEBEE]'
      : tone === 'success'
        ? 'text-[#2E7D32] hover:bg-[#E8F5E9]'
        : 'text-[#42498A] hover:bg-[#F2F6FF]';

  const className = `inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#F7F8FE] transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`;

  if (href && !disabled) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        aria-label={label}
        title={label}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

async function fetchApplicationsForJobs(
  token: string,
  jobs: JobSummary[],
  jobFilterId: string
): Promise<JobApplication[]> {
  const targets =
    jobFilterId === ALL_JOBS ? jobs : jobs.filter((job) => job.id === jobFilterId);

  if (targets.length === 0) return [];

  const titleById = new Map(jobs.map((job) => [job.id, job.title]));
  const batches = await Promise.all(
    targets.map(async (job) => {
      const items = await listJobApplications(token, job.id);
      return items.map((item) => ({
        ...item,
        jobId: item.jobId || job.id,
        jobTitle: item.jobTitle || titleById.get(item.jobId || job.id) || job.title,
      }));
    })
  );

  return batches
    .flat()
    .sort(
      (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );
}

function EmployerApplicantsContent({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activeWorkspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useEmployerWorkspace();
  const activeWorkspaceId = activeWorkspace?.id;
  const basePath = portalConfigs[portal].basePath;

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [jobFilterId, setJobFilterId] = useState(ALL_JOBS);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<JobApplication | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<JobApplication | null>(null);
  const [emailConnected, setEmailConnected] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [jobsReady, setJobsReady] = useState(false);

  /** Deep-link from Dashboard: /applicants?status=interview */
  useEffect(() => {
    const raw = searchParams.get('status');
    if (!raw) return;
    if (raw === 'all') {
      setStatusFilter('all');
      return;
    }
    if (PIPELINE_VALUES.has(raw)) {
      setStatusFilter(raw as PipelineStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    if (workspaceLoading) return;
    if (!activeWorkspaceId) {
      queueMicrotask(() => {
        setJobs([]);
        setApplications([]);
        setJobFilterId(ALL_JOBS);
        setJobsReady(false);
        setError(workspaceError || 'No active employer workspace is available.');
        setLoadingJobs(false);
      });
      return;
    }

    let cancelled = false;
    const token = getStoredToken();
    if (!token) {
      queueMicrotask(() => {
        setError('Your session has expired. Please sign in again.');
        setLoadingJobs(false);
        setJobsReady(false);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingJobs(true);
      setJobsReady(false);
      setJobs([]);
      setApplications([]);
      setJobFilterId(ALL_JOBS);
      setSelectedIds([]);
      setDetailId(null);
    });

    Promise.all([
      listMyJobs(token, { limit: 50, workspaceId: activeWorkspaceId }),
      getEmailStatus(token).catch(() => null),
    ])
      .then(([result, status]) => {
        if (cancelled) return;
        setJobs(result.jobs);
        setJobsReady(true);
        if (status) setEmailConnected(status.connected);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setError(
          requestError instanceof Error ? requestError.message : 'Could not load your jobs.'
        );
        setJobsReady(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingJobs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, workspaceError, workspaceLoading]);

  const loadApplications = useCallback(
    async (options?: { silent?: boolean }) => {
      const token = getStoredToken();
      if (!token || !jobsReady) return;

      if (!options?.silent) {
        setLoadingApplications(true);
        setError(null);
        setSelectedIds([]);
        setDetailId(null);
      }

      try {
        const items = await fetchApplicationsForJobs(token, jobs, jobFilterId);
        setApplications(items);
      } catch (requestError: unknown) {
        setApplications([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load applications.'
        );
      } finally {
        if (!options?.silent) setLoadingApplications(false);
      }
    },
    [jobFilterId, jobs, jobsReady]
  );

  useEffect(() => {
    if (!jobsReady) return;
    void loadApplications();
  }, [jobsReady, jobFilterId, loadApplications]);

  const selectedJob =
    jobFilterId === ALL_JOBS ? null : jobs.find((job) => job.id === jobFilterId) || null;

  const stageCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: applications.length,
      applied: 0,
      screened: 0,
      shortlisted: 0,
      interview: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
    };
    for (const item of applications) {
      const key = normalizePipelineStatus(item.status);
      counts[key] += 1;
    }
    return counts;
  }, [applications]);

  const displayedApplications = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((application) => {
      if (!statusMatchesFilter(application.status, statusFilter)) return false;
      if (!q) return true;
      return (
        application.fullName.toLowerCase().includes(q) ||
        application.email.toLowerCase().includes(q) ||
        (application.jobTitle || '').toLowerCase().includes(q)
      );
    });
  }, [applications, query, statusFilter]);

  const allDisplayedSelected =
    displayedApplications.length > 0 &&
    displayedApplications.every((item) => selectedIds.includes(item.id));

  const detailApplication = detailId
    ? applications.find((item) => item.id === detailId) || null
    : null;

  const startChat = useCallback(
    async (application: JobApplication) => {
      const token = getStoredToken();
      if (!token || messagingId) return;

      if (!application.workspaceId) {
        setError(
          'This application has no workspace assignment. Run the employer workspace migration before starting a chat.'
        );
        return;
      }

      setMessagingId(application.id);
      setError(null);

      try {
        const conversation = await createChatConversation(
          token,
          application.id,
          application.workspaceId
        );
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
      setInfo(null);
      setError(null);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update application status.'
      );
    }
  };

  const handleBulkStatus = async (status: PipelineStatus) => {
    const token = getStoredToken();
    if (!token || selectedIds.length === 0 || bulkBusy) return;

    setBulkBusy(true);
    setError(null);
    setInfo(null);

    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => updateApplicationStatus(token, id, status))
    );

    const succeeded = new Set<string>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') succeeded.add(ids[index]);
    });

    if (succeeded.size > 0) {
      setApplications((prev) =>
        prev.map((item) =>
          succeeded.has(item.id) ? { ...item, status } : item
        )
      );
      setSelectedIds((prev) => prev.filter((id) => !succeeded.has(id)));
      setInfo(
        `Moved ${succeeded.size} applicant${succeeded.size === 1 ? '' : 's'} to ${statusLabel(status)}.`
      );
    }

    const failed = ids.length - succeeded.size;
    if (failed > 0) {
      setError(`Could not update ${failed} applicant${failed === 1 ? '' : 's'}.`);
    }

    setBulkBusy(false);
  };

  const toggleSelectAll = () => {
    if (allDisplayedSelected) {
      const ids = new Set(displayedApplications.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !ids.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of displayedApplications) next.add(item.id);
      return Array.from(next);
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const filterSelectClass =
    'h-10 rounded-lg border border-[#E5E7EE] bg-white px-3 text-sm outline-none focus:border-[#202871]';

  const stageChips: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: stageCounts.all },
    ...STATUS_OPTIONS.map((option) => ({
      value: option.value as StatusFilter,
      label: option.label,
      count: stageCounts[option.value],
    })),
  ];

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="text-xl font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Hiring pipeline
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Review, shortlist, and message applicants across your jobs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                className="h-10 rounded-lg border border-[#E5E7EE] px-3 text-xs font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Connect mailbox
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void loadApplications()}
              disabled={!jobsReady || loadingApplications}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EE] text-[#42498A] transition hover:bg-[#F7F8FE] disabled:opacity-50"
              aria-label="Refresh applicants"
              title="Refresh"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
            </button>
          </div>
        </div>

        {info ? (
          <div
            className="rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {info}
          </div>
        ) : null}
        {error ? (
          <div
            className="rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          {/* Stage counts */}
          <div className="flex flex-wrap gap-2 border-b border-[#EEF0F8] px-4 py-3 md:px-5">
            {stageChips.map((chip) => {
              const active = statusFilter === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setStatusFilter(chip.value)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-[#202871] text-white'
                      : 'bg-[#F7F8FE] text-[#42498A] hover:bg-[#EEF0F8]'
                  }`}
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {chip.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-[#858BBD]'
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 border-b border-[#EEF0F8] p-4 md:flex-row md:items-center md:justify-between md:px-5">
            <form
              className="w-full md:max-w-xs"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(queryInput.trim());
              }}
            >
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#858BBD]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => {
                    setQueryInput(event.target.value);
                    setQuery(event.target.value.trim());
                  }}
                  placeholder="Search name, email, or job"
                  className="h-10 w-full rounded-lg border border-[#E5E7EE] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#202871]"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={jobFilterId}
                onChange={(event) => setJobFilterId(event.target.value)}
                disabled={loadingJobs || jobs.length === 0}
                className={`${filterSelectClass} min-w-[180px] max-w-[280px]`}
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {jobs.length === 0 ? (
                  <option value={ALL_JOBS}>No jobs found</option>
                ) : (
                  <>
                    <option value={ALL_JOBS}>All jobs · {jobs.length}</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} · {job.applicants}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E1FF] bg-[#F2F6FF] px-4 py-3 md:px-5">
              <p
                className="text-sm font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {selectedIds.length} selected
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkStatus('screened')}
                  className="rounded-lg border border-[#E5E7EE] bg-white px-3 py-1.5 text-xs font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-60"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  Screened
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkStatus('shortlisted')}
                  className="rounded-lg bg-[#E3F2FD] px-3 py-1.5 text-xs font-semibold text-[#1565C0] transition hover:bg-[#D6EAFB] disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Shortlist
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkStatus('interview')}
                  className="rounded-lg bg-[#F3E5F5] px-3 py-1.5 text-xs font-semibold text-[#6A1B9A] transition hover:bg-[#EBD9F0] disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Interview
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkStatus('rejected')}
                  className="rounded-lg bg-[#FFEBEE] px-3 py-1.5 text-xs font-semibold text-[#C62828] transition hover:bg-[#F8D7DA] disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setSelectedIds([])}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#858BBD] transition hover:text-[#42498A] disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="w-full overflow-hidden">
            {loadingJobs || loadingApplications ? (
              <p
                className="px-6 py-12 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Loading applications...
              </p>
            ) : displayedApplications.length === 0 ? (
              <p
                className="px-6 py-12 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                {applications.length === 0
                  ? jobFilterId === ALL_JOBS
                    ? 'No applications yet across your jobs.'
                    : 'No applications for this job yet.'
                  : 'No applicants match your filters.'}
              </p>
            ) : (
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#EEF0F8] bg-[#F7F8FE]">
                    <th className="px-3 py-3 pl-5">
                      <input
                        type="checkbox"
                        checked={allDisplayedSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all applicants"
                        className="h-4 w-4 cursor-pointer rounded border-[#C9D2E0] accent-[#202871]"
                      />
                    </th>
                    {[
                      'Candidate',
                      'Job',
                      'Status',
                      'Applied',
                      'Resume',
                      'Pipeline',
                      'Action',
                    ].map((label) => (
                      <th
                        key={label}
                        className="px-2 py-3 text-xs font-semibold uppercase tracking-wide text-[#858BBD] last:pr-4"
                        style={{ fontFamily: 'var(--font-poppins)' }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedApplications.map((application) => {
                    const badge = statusStyles(application.status);
                    const isSelected = selectedIds.includes(application.id);
                    const busy = messagingId === application.id;
                    const resumeHref =
                      application.resumeDownloadUrl || application.resumeUrl || '';
                    const jobLabel = application.jobTitle || '—';

                    return (
                      <tr
                        key={application.id}
                        className={`border-b border-[#EEF0F8] last:border-b-0 hover:bg-[#FCFCFF] ${
                          isSelected ? 'bg-[#F7F9FF]' : ''
                        }`}
                      >
                        <td className="px-3 py-3.5 pl-5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(application.id)}
                            aria-label={`Select ${application.fullName}`}
                            className="h-4 w-4 cursor-pointer rounded border-[#C9D2E0] accent-[#202871]"
                          />
                        </td>
                        <td className="px-2 py-3.5">
                          <button
                            type="button"
                            onClick={() => setDetailId(application.id)}
                            className="flex min-w-0 items-center gap-2.5 text-left"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
                              <span
                                className="text-[11px] font-bold"
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
                            </div>
                          </button>
                        </td>
                        <td
                          className="truncate px-2 py-3.5 text-sm"
                          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                          title={jobLabel}
                        >
                          {jobLabel}
                        </td>
                        <td className="px-2 py-3.5">
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              color: badge.color,
                              backgroundColor: badge.background,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {statusLabel(application.status)}
                          </span>
                        </td>
                        <td
                          className="px-2 py-3.5 text-sm"
                          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                        >
                          {formatAppliedAt(application.appliedAt)}
                        </td>
                        <td className="px-2 py-3.5">
                          {resumeHref ? (
                            <a
                              href={resumeHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-semibold text-[#202871] hover:underline"
                              style={{ fontFamily: 'var(--font-poppins)' }}
                              title={application.resumeName || 'Resume'}
                            >
                              <svg
                                className="h-3.5 w-3.5 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.7}
                                stroke="currentColor"
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                                />
                              </svg>
                              <span className="truncate">
                                {application.resumeName || 'Resume'}
                              </span>
                            </a>
                          ) : (
                            <span
                              className="text-xs"
                              style={{
                                color: colors.muted,
                                fontFamily: 'var(--font-poppins)',
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3.5">
                          <select
                            value={normalizePipelineStatus(application.status)}
                            onChange={(event) => {
                              void handleStatusChange(application.id, event.target.value);
                            }}
                            className="h-8 w-full max-w-[120px] rounded-lg border border-[#E5E7EE] bg-white px-2 text-xs font-semibold outline-none focus:border-[#202871]"
                            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-2 py-3.5 last:pr-4">
                          <div className="flex flex-nowrap items-center gap-1">
                            <ActionIconButton
                              label="View details"
                              onClick={() => setDetailId(application.id)}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </ActionIconButton>

                            <ActionIconButton
                              label={busy ? 'Opening chat...' : 'Message in InChat'}
                              disabled={Boolean(messagingId)}
                              onClick={() => void startChat(application)}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.199C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                                />
                              </svg>
                            </ActionIconButton>

                            <ActionIconButton
                              label="Email applicant"
                              onClick={() => setEmailTarget(application)}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                                />
                              </svg>
                            </ActionIconButton>

                            <ActionIconButton
                              label="Schedule interview"
                              onClick={() => setScheduleTarget(application)}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                                />
                              </svg>
                            </ActionIconButton>

                            {resumeHref ? (
                              <ActionIconButton label="Open resume" href={resumeHref}>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                                  />
                                </svg>
                              </ActionIconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0F8] px-4 py-3.5 md:px-5">
            <p
              className="text-xs"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              {displayedApplications.length} applicant
              {displayedApplications.length === 1 ? '' : 's'}
              {selectedJob
                ? ` · ${selectedJob.title}`
                : jobFilterId === ALL_JOBS
                  ? ' · All jobs'
                  : ''}
              {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
            </p>
          </div>
        </div>
      </div>

      {detailApplication ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close details"
            onClick={() => setDetailId(null)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#EEF0F8] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
                  <span
                    className="text-sm font-bold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    {initialsFromName(detailApplication.fullName)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate text-base font-semibold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    {detailApplication.fullName}
                  </p>
                  <p
                    className="truncate text-xs"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    {detailApplication.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="rounded-lg border border-[#E5E7EE] px-2.5 py-1 text-xs font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    ...statusStyles(detailApplication.status),
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  {statusLabel(detailApplication.status)}
                </span>
                <span
                  className="text-xs"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  Applied {formatAppliedAt(detailApplication.appliedAt)}
                </span>
              </div>

              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  Job
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  {detailApplication.jobTitle || selectedJob?.title || '—'}
                </p>
              </div>

              <div>
                <p
                  className="mb-1.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  Move in pipeline
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => {
                    const active =
                      normalizePipelineStatus(detailApplication.status) === status.value;
                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() =>
                          void handleStatusChange(detailApplication.id, status.value)
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? 'bg-[#202871] text-white'
                            : 'border border-[#E5E7EE] bg-white text-[#42498A] hover:bg-[#F7F8FE]'
                        }`}
                        style={{ fontFamily: 'var(--font-poppins)' }}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  Motivation
                </p>
                <p
                  className="mt-1 whitespace-pre-wrap text-sm leading-relaxed"
                  style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                >
                  {detailApplication.motivation?.trim() || 'No motivation note provided.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-[#EEF0F8] px-5 py-4">
              {(detailApplication.resumeDownloadUrl || detailApplication.resumeUrl) && (
                <a
                  href={
                    detailApplication.resumeDownloadUrl ||
                    detailApplication.resumeUrl ||
                    '#'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2160]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Open resume
                </a>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={Boolean(messagingId)}
                  onClick={() => void startChat(detailApplication)}
                  className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-60"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  {messagingId === detailApplication.id ? 'Opening…' : 'InChat'}
                </button>
                <button
                  type="button"
                  onClick={() => setEmailTarget(detailApplication)}
                  className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F7F8FE]"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  Email
                </button>
              </div>
              <button
                type="button"
                onClick={() => setScheduleTarget(detailApplication)}
                className="flex w-full items-center justify-center rounded-xl border border-[#202871] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F7F8FE]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Schedule interview
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {emailTarget ? (
        <EmailComposeModal
          to={emailTarget.email}
          applicantName={emailTarget.fullName}
          applicationId={emailTarget.id}
          jobTitle={emailTarget.jobTitle || selectedJob?.title}
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

      {scheduleTarget ? (
        <ScheduleInterviewModal
          open
          candidate={{
            applicationId: scheduleTarget.id,
            fullName: scheduleTarget.fullName,
            email: scheduleTarget.email,
            jobTitle: scheduleTarget.jobTitle || selectedJob?.title || '',
          }}
          onClose={() => setScheduleTarget(null)}
          onScheduled={(message) => {
            setScheduleTarget(null);
            setInfo(message);
            void loadApplications({ silent: true });
          }}
        />
      ) : null}
    </>
  );
}

export default function EmployerApplicantsPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 text-sm text-[#858BBD]">
          Loading applicants…
        </div>
      }
    >
      <EmployerApplicantsContent portal={portal} />
    </Suspense>
  );
}
