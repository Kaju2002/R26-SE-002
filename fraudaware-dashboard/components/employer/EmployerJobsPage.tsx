'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import EmployerJobForm, { emptyJobForm } from '@/components/employer/EmployerJobForm';
import { useEmployerWorkspace } from '@/components/employer/EmployerWorkspaceContext';
import type { AuthUser } from '@/lib/api/authTypes';
import {
  createJob,
  deleteJob,
  descriptionToText,
  listMyJobs,
  listToMultiline,
  skillsToCsv,
  updateJob,
  type CreateJobPayload,
  type JobStatus,
  type JobSummary,
  type PaginationInfo,
} from '@/lib/api/jobApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken, getStoredUser } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const PAGE_SIZE = 8;

const STATUS_FILTERS: { value: JobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];

const TYPE_FILTERS = [
  { value: 'all', label: 'All Types' },
  { value: 'Full-Time', label: 'Full-Time' },
  { value: 'Part-Time', label: 'Part-Time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
] as const;

const MODE_FILTERS = [
  { value: 'all', label: 'All Modes' },
  { value: 'On-Site', label: 'On-Site' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
] as const;

function statusStyles(status: string): { color: string; background: string } {
  if (status === 'active') return { color: '#2E7D32', background: '#E8F5E9' };
  if (status === 'draft') return { color: '#EF6C00', background: '#FFF3E0' };
  if (status === 'pending_review') return { color: '#6A1B9A', background: '#F3E5F5' };
  return { color: '#C62828', background: '#FFEBEE' };
}

function formatSalary(job: JobSummary): string {
  const currency = job.salaryCurrency || 'LKR';
  const min = job.salaryMin;
  const max = job.salaryMax;
  if (!min && !max) return '—';
  if (min && max && min !== max) {
    return `${currency} ${Math.round(min / 1000)}k–${Math.round(max / 1000)}k`;
  }
  return `${currency} ${Math.round((max || min || 0) / 1000)}k`;
}

function formatPosted(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function jobToForm(job: JobSummary, fallbackCompany = ''): CreateJobPayload {
  return {
    workspaceId: job.workspaceId || undefined,
    title: job.title,
    companyName: job.companyName || fallbackCompany,
    location: job.location || '',
    mode: (job.mode as CreateJobPayload['mode']) || 'On-Site',
    type: (job.type as CreateJobPayload['type']) || 'Full-Time',
    salaryMin: job.salaryMin ?? 0,
    salaryMax: job.salaryMax ?? 0,
    salaryCurrency: job.salaryCurrency || 'LKR',
    description: descriptionToText(job.description),
    requirements: listToMultiline(job.requirements),
    skills: skillsToCsv(job.skills),
    benefits: listToMultiline(job.benefits),
    about: job.about || '',
    email: job.contact?.email || '',
    phone: job.contact?.phone || '',
    website: job.contact?.website || '',
    jobLevel: job.jobLevel || '',
    education: job.education || '',
    experience: job.experience || '',
    status: (job.status as JobStatus) || 'draft',
    posterImage: job.posterImage || '',
  };
}

function ActionIconButton({
  label,
  onClick,
  href,
  tone = 'default',
  children,
}: {
  label: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  href?: string;
  tone?: 'default' | 'danger' | 'success' | 'warn';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-[#C62828] hover:bg-[#FFEBEE]'
      : tone === 'success'
        ? 'text-[#2E7D32] hover:bg-[#E8F5E9]'
        : tone === 'warn'
          ? 'text-[#EF6C00] hover:bg-[#FFF3E0]'
          : 'text-[#42498A] hover:bg-[#F2F6FF]';

  const className = `inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#F7F8FE] transition ${toneClass}`;

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label} title={label} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function EmployerJobsContent({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const isCompany = portal === 'company';
  const {
    activeWorkspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useEmployerWorkspace();
  const activeWorkspaceId = activeWorkspace?.id;
  const basePath = portalConfigs[portal].basePath;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]['value']>('all');
  const [modeFilter, setModeFilter] = useState<(typeof MODE_FILTERS)[number]['value']>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingJob, setEditingJob] = useState<JobSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const requestIdRef = useRef(0);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (workspaceLoading) return;
    if (!activeWorkspaceId) {
      setJobs([]);
      setError(workspaceError || 'No active employer workspace is available.');
      setLoading(false);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await listMyJobs(token, {
        page,
        limit: PAGE_SIZE,
        status: statusFilter,
        q: query,
        sort: 'newly_posted',
        workspaceId: activeWorkspaceId,
      });
      if (requestId !== requestIdRef.current) return;
      setJobs(result.jobs);
      setPagination(result.pagination);
      setSelectedIds([]);
      setError(null);
    } catch (requestError: unknown) {
      if (requestId !== requestIdRef.current) return;
      setError(
        requestError instanceof Error ? requestError.message : 'Could not load jobs.'
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [
    activeWorkspaceId,
    page,
    query,
    statusFilter,
    workspaceError,
    workspaceLoading,
  ]);

  useEffect(() => {
    const stored = getStoredUser();
    queueMicrotask(() => setUser(stored));
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    queueMicrotask(() => {
      setJobs([]);
      setPagination({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      });
      setPage(1);
      setQueryInput('');
      setQuery('');
      setStatusFilter('all');
      setTypeFilter('all');
      setModeFilter('all');
      setMode('list');
      setEditingJob(null);
      setSelectedIds([]);
      setMessage(null);
      setError(
        !workspaceLoading && !activeWorkspaceId
          ? workspaceError || 'No active employer workspace is available.'
          : null
      );
    });
  }, [activeWorkspaceId, workspaceError, workspaceLoading]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const displayedJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (typeFilter !== 'all' && job.type !== typeFilter) return false;
      if (modeFilter !== 'all' && job.mode !== modeFilter) return false;
      return true;
    });
  }, [jobs, typeFilter, modeFilter]);

  const allDisplayedSelected =
    displayedJobs.length > 0 &&
    displayedJobs.every((job) => selectedIds.includes(job.id));

  const someDisplayedSelected =
    displayedJobs.some((job) => selectedIds.includes(job.id)) && !allDisplayedSelected;

  const toggleSelectAll = () => {
    if (allDisplayedSelected) {
      const displayedIdSet = new Set(displayedJobs.map((job) => job.id));
      setSelectedIds((prev) => prev.filter((id) => !displayedIdSet.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const job of displayedJobs) next.add(job.id);
      return Array.from(next);
    });
  };

  const toggleSelectOne = (jobId: string) => {
    setSelectedIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someDisplayedSelected;
    }
  }, [someDisplayedSelected]);

  const formInitial = useMemo(() => {
    if (mode === 'edit' && editingJob) {
      return jobToForm(editingJob, activeWorkspace?.name || user?.company?.name || '');
    }
    return emptyJobForm(activeWorkspace?.name || user?.company?.name || '');
  }, [activeWorkspace?.name, mode, editingJob, user?.company?.name]);

  const inheritedCompanyLogoUrl =
    activeWorkspace?.logo || user?.company?.logo || null;

  const canPublishLive = Boolean(user?.company?.isVerified);

  const ensureJobInActiveWorkspace = useCallback(
    (job: JobSummary): boolean => {
      if (!activeWorkspaceId || job.workspaceId !== activeWorkspaceId) {
        setError(
          job.workspaceId
            ? 'This job belongs to a different workspace. Switch to that workspace before acting on it.'
            : 'This legacy job has no workspace assignment. Run the employer workspace migration before acting on it.'
        );
        setMessage(null);
        return false;
      }
      return true;
    },
    [activeWorkspaceId]
  );

  const closeForm = () => {
    setMode('list');
    setEditingJob(null);
  };

  const handleCreateOrUpdate = async (
    payload: CreateJobPayload,
    logoFile: File | null,
    posterFile: File | null
  ) => {
    const token = getStoredToken();
    if (!token) return;
    if (!activeWorkspaceId) {
      setError('Select an active workspace before saving a job.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'edit' && editingJob) {
        if (!ensureJobInActiveWorkspace(editingJob)) return;
        const saved = await updateJob(
          token,
          editingJob.id,
          { ...payload, workspaceId: activeWorkspaceId },
          logoFile,
          posterFile
        );
        setMessage(
          saved.status === 'pending_review'
            ? `“${payload.title}” was held for admin review and is not visible to job seekers yet.`
            : `Updated “${payload.title}”.`
        );
      } else {
        const saved = await createJob(
          token,
          { ...payload, workspaceId: activeWorkspaceId },
          logoFile,
          posterFile
        );
        setMessage(
          saved.status === 'pending_review'
            ? `“${payload.title}” was held for admin review and is not visible to job seekers yet.`
            : saved.status === 'draft'
              ? `Saved “${payload.title}” as draft.`
              : `Published “${payload.title}”.`
        );
      }
      closeForm();
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not save job.'
      );
    } finally {
      setSaving(false);
    }
  };

  const setJobStatus = async (job: JobSummary, status: JobStatus) => {
    const token = getStoredToken();
    if (!token) return;
    if (!ensureJobInActiveWorkspace(job)) return;
    setError(null);
    setMessage(null);

    try {
      const saved = await updateJob(token, job.id, { status, workspaceId: activeWorkspaceId });
      setMessage(
        saved.status === 'pending_review'
          ? `“${job.title}” was held for admin review and is not visible to job seekers yet.`
          : saved.status === 'active'
            ? `“${job.title}” is now active.`
            : saved.status === 'closed'
              ? `“${job.title}” was closed.`
              : `“${job.title}” moved to draft.`
      );
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update job status.'
      );
    }
  };

  const handleDelete = async (job: JobSummary) => {
    const token = getStoredToken();
    if (!token) return;
    if (!ensureJobInActiveWorkspace(job)) return;
    if (!window.confirm('Delete this job posting permanently?')) return;

    try {
      await deleteJob(token, job.id);
      setMessage('Job deleted.');
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not delete job.'
      );
    }
  };

  const filterSelectClass =
    'h-10 rounded-lg border border-[#E5E7EE] bg-white px-3 text-sm outline-none focus:border-[#202871]';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-xl font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {mode === 'list' ? 'Job List' : mode === 'edit' ? 'Edit Job' : 'Post Job'}
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            {mode === 'list'
              ? 'Manage your job openings'
              : 'Fill in the details for this posting'}
          </p>
        </div>

        {mode === 'list' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EE] text-[#42498A] transition hover:bg-[#F7F8FE]"
              aria-label="Refresh jobs"
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
            <button
              type="button"
              disabled={!activeWorkspaceId}
              onClick={() => {
                setEditingJob(null);
                setMode('create');
                setError(null);
                setMessage(null);
              }}
              className="h-10 rounded-lg bg-[#202871] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Post Job
            </button>
          </div>
        ) : null}
      </div>

      {message ? (
        <div
          className="rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          {message}
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

      {!canPublishLive && mode === 'list' ? (
        <div
          className="rounded-xl border border-[#FFF3E0] bg-[#FFF8E1] px-4 py-3 text-sm text-[#EF6C00]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Your company is not verified yet. You can save job drafts, but live publishing stays
          locked until verification is approved.{' '}
          <Link href={`${basePath}/profile`} className="font-semibold underline">
            Complete verification
          </Link>
        </div>
      ) : null}

      {mode !== 'list' ? (
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm md:p-8">
          <EmployerJobForm
            isCompany={isCompany}
            user={user}
            companyNameOverride={activeWorkspace?.name}
            initial={formInitial}
            existingLogoUrl={editingJob?.companyLogoUri ?? inheritedCompanyLogoUrl}
            existingPosterUrl={editingJob?.posterImage}
            submitLabel={mode === 'edit' ? 'Save changes' : 'Save job'}
            saving={saving}
            onCancel={closeForm}
            onSubmit={handleCreateOrUpdate}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          {/* Filters toolbar */}
          <div className="flex flex-col gap-3 border-b border-[#EEF0F8] p-4 md:flex-row md:items-center md:justify-between md:px-5">
            <form
              className="w-full md:max-w-xs"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
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
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search"
                  className="h-10 w-full rounded-lg border border-[#E5E7EE] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#202871]"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value as JobStatus | 'all');
                }}
                className={filterSelectClass}
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as (typeof TYPE_FILTERS)[number]['value'])
                }
                className={filterSelectClass}
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {TYPE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={modeFilter}
                onChange={(event) =>
                  setModeFilter(event.target.value as (typeof MODE_FILTERS)[number]['value'])
                }
                className={filterSelectClass}
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {MODE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="w-full overflow-hidden">
            {loading ? (
              <p
                className="px-6 py-12 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Loading jobs...
              </p>
            ) : displayedJobs.length === 0 ? (
              <p
                className="px-6 py-12 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                No jobs match your filters.
              </p>
            ) : (
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[22%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                  <col className="w-[7%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#EEF0F8] bg-[#FAFBFF]">
                    <th className="px-3 py-3 pl-5">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allDisplayedSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all jobs on this page"
                        className="h-4 w-4 cursor-pointer rounded border-[#C9D2E0] accent-[#202871]"
                      />
                    </th>
                    {[
                      { label: 'Job', align: 'left' },
                      { label: 'Status', align: 'left' },
                      { label: 'Applicants', align: 'center' },
                      { label: 'Location', align: 'left' },
                      { label: 'Type', align: 'left' },
                      { label: 'Mode', align: 'left' },
                      { label: 'Salary', align: 'left' },
                      { label: 'Posted', align: 'left' },
                      { label: 'Action', align: 'left' },
                    ].map((heading) => (
                      <th
                        key={heading.label}
                        className={`px-2 py-3 text-xs font-semibold uppercase tracking-wide text-[#858BBD] last:pr-4 ${
                          heading.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                        style={{ fontFamily: 'var(--font-poppins)' }}
                      >
                        {heading.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedJobs.map((job) => {
                    const badge = statusStyles(job.status);
                    const thumb = job.companyLogoUri || job.posterImage;
                    const isSelected = selectedIds.includes(job.id);
                    return (
                      <tr
                        key={job.id}
                        className={`border-b border-[#EEF0F8] last:border-b-0 hover:bg-[#FCFCFF] ${
                          isSelected ? 'bg-[#F7F9FF]' : ''
                        }`}
                      >
                        <td className="px-3 py-3.5 pl-5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(job.id)}
                            aria-label={`Select ${job.title}`}
                            className="h-4 w-4 cursor-pointer rounded border-[#C9D2E0] accent-[#202871]"
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#EEF0F8]">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumb}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span
                                  className="text-[11px] font-bold"
                                  style={{
                                    color: colors.navy,
                                    fontFamily: 'var(--font-poppins)',
                                  }}
                                >
                                  {(job.companyName || 'J').slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-semibold"
                                style={{
                                  color: colors.navy,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {job.title}
                              </p>
                              <p
                                className="truncate text-xs"
                                style={{
                                  color: colors.muted,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {job.companyName || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3.5">
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
                            style={{
                              color: badge.color,
                              backgroundColor: badge.background,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {formatStatusLabel(job.status)}
                          </span>
                        </td>
                        <td
                          className="px-2 py-3.5 text-center text-sm font-medium"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {job.applicants ?? 0}
                        </td>
                        <td
                          className="truncate px-3 py-3.5 text-sm"
                          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                          title={job.location || undefined}
                        >
                          {job.location || '—'}
                        </td>
                        <td
                          className="truncate px-3 py-3.5 text-sm"
                          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                        >
                          {job.type || '—'}
                        </td>
                        <td
                          className="truncate px-3 py-3.5 text-sm"
                          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                        >
                          {job.mode || '—'}
                        </td>
                        <td
                          className="truncate px-3 py-3.5 text-sm"
                          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                          title={formatSalary(job)}
                        >
                          {formatSalary(job)}
                        </td>
                        <td
                          className="truncate px-3 py-3.5 text-sm"
                          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                        >
                          {formatPosted(job.postedAt)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3.5 last:pr-4">
                          <div className="flex flex-nowrap items-center gap-1">
                            <ActionIconButton
                              label="View details"
                              href={`${basePath}/jobs/${job.id}`}
                              onClick={(event) => {
                                if (!ensureJobInActiveWorkspace(job)) {
                                  event.preventDefault();
                                }
                              }}
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
                              label="Edit job"
                              onClick={() => {
                                if (!ensureJobInActiveWorkspace(job)) return;
                                setEditingJob(job);
                                setMode('edit');
                                setMessage(null);
                                setError(null);
                              }}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                                />
                              </svg>
                            </ActionIconButton>

                            {job.status === 'draft' || job.status === 'closed' ? (
                              <ActionIconButton
                                label={
                                  !canPublishLive
                                    ? 'Verify company to publish'
                                    : job.status === 'closed'
                                      ? 'Republish'
                                      : 'Publish'
                                }
                                tone="success"
                                onClick={() => {
                                  if (!canPublishLive) {
                                    setError(
                                      'Your company must be verified before a job can go live. Save as draft and complete verification first.'
                                    );
                                    return;
                                  }
                                  void setJobStatus(job, 'active');
                                }}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </ActionIconButton>
                            ) : null}

                            {job.status === 'active' ? (
                              <ActionIconButton
                                label="Close job"
                                tone="warn"
                                onClick={() => void setJobStatus(job, 'closed')}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                  />
                                </svg>
                              </ActionIconButton>
                            ) : null}

                            {job.status === 'active' ? (
                              <ActionIconButton
                                label="Move to draft"
                                onClick={() => void setJobStatus(job, 'draft')}
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                                  />
                                </svg>
                              </ActionIconButton>
                            ) : null}

                            <ActionIconButton
                              label="Delete job"
                              tone="danger"
                              onClick={() => void handleDelete(job)}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
                              </svg>
                            </ActionIconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0F8] px-4 py-3.5 md:px-5">
            <p
              className="text-xs"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              {pagination.totalPages > 1
                ? `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} jobs`
                : `${pagination.total} job${pagination.total === 1 ? '' : 's'}`}
              {typeFilter !== 'all' || modeFilter !== 'all'
                ? ` · showing ${displayedJobs.length} on this page`
                : ''}
              {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
            </p>
            {pagination.totalPages > 1 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-[#E5E7EE] px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(pagination.totalPages, value + 1))
                  }
                  className="rounded-lg border border-[#E5E7EE] px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployerJobsPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  return <EmployerJobsContent portal={portal} />;
}
