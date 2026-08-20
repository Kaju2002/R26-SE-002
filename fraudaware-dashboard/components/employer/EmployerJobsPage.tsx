'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EmployerJobForm, { emptyJobForm } from '@/components/employer/EmployerJobForm';
import { useEmployerWorkspace } from '@/components/employer/EmployerWorkspaceContext';
import type { AuthUser } from '@/lib/api/authTypes';
import { buildJobRiskText, predictFakeJobFromText } from '@/lib/api/fakeJobApi';
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
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];

function statusStyles(status: string): { color: string; background: string } {
  if (status === 'active') return { color: '#2E7D32', background: '#E8F5E9' };
  if (status === 'draft') return { color: '#EF6C00', background: '#FFF3E0' };
  return { color: '#C62828', background: '#FFEBEE' };
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
    jobLevel: job.jobLevel || '',
    education: job.education || '',
    experience: job.experience || '',
    status: (job.status as JobStatus) || 'draft',
    posterImage: job.posterImage || '',
  };
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingJob, setEditingJob] = useState<JobSummary | null>(null);
  const requestIdRef = useRef(0);

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
      setMode('list');
      setEditingJob(null);
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

  const formInitial = useMemo(() => {
    if (mode === 'edit' && editingJob) {
      return jobToForm(editingJob, activeWorkspace?.name || user?.company?.name || '');
    }
    return emptyJobForm(activeWorkspace?.name || user?.company?.name || '');
  }, [activeWorkspace?.name, mode, editingJob, user?.company?.name]);

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
    logoFile: File | null
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
        await updateJob(
          token,
          editingJob.id,
          { ...payload, workspaceId: activeWorkspaceId },
          logoFile
        );
        setMessage(`Updated “${payload.title}”.`);
      } else {
        await createJob(token, { ...payload, workspaceId: activeWorkspaceId }, logoFile);
        setMessage(
          payload.status === 'draft'
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

    if (status === 'active') {
      try {
        const text = buildJobRiskText({
          title: job.title,
          companyName: job.companyName,
          location: job.location || '',
          description: descriptionToText(job.description) || job.title,
          requirements: listToMultiline(job.requirements),
          skills: skillsToCsv(job.skills),
        });
        const risk = await predictFakeJobFromText(text);
        const prediction = risk.prediction.toLowerCase();
        if (prediction === 'fake' || prediction === 'suspicious') {
          const proceed = window.confirm(
            `${risk.message}\n\nPublish “${job.title}” anyway?`
          );
          if (!proceed) return;
        } else {
          setMessage(risk.message);
        }
      } catch (requestError: unknown) {
        const proceed = window.confirm(
          `${
            requestError instanceof Error
              ? requestError.message
              : 'Fake-job check failed.'
          }\n\nPublish without a completed risk check?`
        );
        if (!proceed) return;
      }
    }

    try {
      await updateJob(token, job.id, { status, workspaceId: activeWorkspaceId });
      setMessage(
        status === 'active'
          ? `“${job.title}” is now active.`
          : status === 'closed'
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

  return (
    <>
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2
                className="text-xl font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Jobs
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Create drafts, publish openings, edit listings, close or republish, and
                review fake-job risk before going live.
              </p>
            </div>
            {mode === 'list' ? (
              <button
                type="button"
                disabled={!activeWorkspaceId}
                onClick={() => {
                  setEditingJob(null);
                  setMode('create');
                  setError(null);
                  setMessage(null);
                }}
                className="rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Post a job
              </button>
            ) : null}
          </div>

          {mode !== 'list' ? (
            <>
              <h3
                className="mt-6 text-base font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {mode === 'edit' ? 'Edit job' : 'Create job'}
              </h3>
              <EmployerJobForm
                isCompany={isCompany}
                user={user}
                companyNameOverride={activeWorkspace?.name}
                initial={formInitial}
                existingLogoUrl={editingJob?.companyLogoUri}
                submitLabel={mode === 'edit' ? 'Save changes' : 'Save job'}
                saving={saving}
                onCancel={closeForm}
                onSubmit={handleCreateOrUpdate}
              />
            </>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                  setQuery(queryInput.trim());
                }}
              >
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search title, company, location…"
                  className="h-11 w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 text-sm outline-none focus:border-[#202871]"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                />
              </form>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value as JobStatus | 'all');
                }}
                className="h-11 rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 text-sm outline-none focus:border-[#202871]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setQuery(queryInput.trim());
                }}
                className="h-11 rounded-xl border border-[#E5E7EE] px-4 text-sm font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Search
              </button>
            </div>
          )}

          {message ? (
            <div
              className="mt-4 rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
            </div>
          ) : null}
          {error ? (
            <div
              className="mt-4 rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </div>
          ) : null}
        </div>

        {mode === 'list' ? (
          <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
            {loading ? (
              <p
                className="px-6 py-10 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Loading jobs...
              </p>
            ) : jobs.length === 0 ? (
              <p
                className="px-6 py-10 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                No jobs match your filters.
              </p>
            ) : (
              <ul className="divide-y divide-[#EEF0F8]">
                {jobs.map((job) => {
                  const badge = statusStyles(job.status);
                  return (
                    <li
                      key={job.id}
                      className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6"
                    >
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="relative h-11 w-11 shrink-0">
                          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#EEF0F8]">
                            {job.companyLogoUri ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={job.companyLogoUri}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span
                                className="text-xs font-bold"
                                style={{
                                  color: colors.navy,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {(job.companyName || 'J').slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          {job.posterImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={job.posterImage}
                              alt=""
                              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className="truncate text-sm font-semibold"
                              style={{
                                color: colors.navy,
                                fontFamily: 'var(--font-poppins)',
                              }}
                            >
                              {job.title}
                            </p>
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                              style={{
                                color: badge.color,
                                backgroundColor: badge.background,
                                fontFamily: 'var(--font-poppins)',
                              }}
                            >
                              {job.status}
                            </span>
                          </div>
                          <p
                            className="mt-1 text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {job.companyName}
                            {job.location ? ` · ${job.location}` : ''}
                            {` · ${job.applicants} applicants`}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`${basePath}/jobs/${job.id}`}
                          onClick={(event) => {
                            if (!ensureJobInActiveWorkspace(job)) event.preventDefault();
                          }}
                          className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            if (!ensureJobInActiveWorkspace(job)) return;
                            setEditingJob(job);
                            setMode('edit');
                            setMessage(null);
                            setError(null);
                          }}
                          className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          Edit
                        </button>
                        {job.status === 'draft' || job.status === 'closed' ? (
                          <button
                            type="button"
                            onClick={() => void setJobStatus(job, 'active')}
                            className="rounded-xl border border-[#C8E6C9] px-3 py-2 text-xs font-semibold text-[#2E7D32]"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                          >
                            {job.status === 'closed' ? 'Republish' : 'Publish'}
                          </button>
                        ) : null}
                        {job.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => void setJobStatus(job, 'closed')}
                            className="rounded-xl border border-[#FFE0B2] px-3 py-2 text-xs font-semibold text-[#EF6C00]"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                          >
                            Close
                          </button>
                        ) : null}
                        {job.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => void setJobStatus(job, 'draft')}
                            className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold"
                            style={{
                              color: colors.body,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            Move to draft
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleDelete(job)}
                          className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold text-[#C62828]"
                          style={{ fontFamily: 'var(--font-poppins)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {pagination.totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF0F8] px-5 py-4 md:px-6">
                <p
                  className="text-xs"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total}{' '}
                  jobs
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold disabled:opacity-50"
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
                    className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold disabled:opacity-50"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-[#EEF0F8] px-5 py-3 md:px-6">
                <p
                  className="text-xs"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  {pagination.total} job{pagination.total === 1 ? '' : 's'}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function EmployerJobsPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  return <EmployerJobsContent portal={portal} />;
}
