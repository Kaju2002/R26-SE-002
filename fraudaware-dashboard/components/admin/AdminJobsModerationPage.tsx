'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import type { JobModerationStatus } from '@/lib/admin/jobModerationTypes';
import {
  listModerationJobs,
  moderateJob,
  type ModeratedJobRecord,
} from '@/lib/api/jobApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type StatusFilter = 'all' | JobModerationStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All listings' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'force_closed', label: 'Force-closed' },
];

const FLAG_LABELS: Record<string, string> = {
  fake_job_model: 'Fake-job model',
  user_report: 'User report',
  payment_request: 'Payment request',
  suspicious_employer: 'Suspicious employer',
  duplicate_scam_pattern: 'Duplicate scam pattern',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scoreStyles(score: number): { label: string; color: string; background: string } {
  if (score < 0.35) {
    return { label: 'Low fake risk', color: '#2E7D32', background: '#E8F5E9' };
  }
  if (score < 0.7) {
    return { label: 'Medium fake risk', color: '#EF6C00', background: '#FFF3E0' };
  }
  return { label: 'High fake risk', color: '#C62828', background: '#FFEBEE' };
}

function moderationStyles(status: JobModerationStatus): {
  color: string;
  background: string;
  label: string;
} {
  if (status === 'cleared') {
    return { color: '#2E7D32', background: '#E8F5E9', label: 'Cleared' };
  }
  if (status === 'force_closed') {
    return { color: '#C62828', background: '#FFEBEE', label: 'Force-closed' };
  }
  return { color: '#EF6C00', background: '#FFF3E0', label: 'Flagged' };
}

export default function AdminJobsModerationPage() {
  const [jobs, setJobs] = useState<ModeratedJobRecord[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    flagged: 0,
    cleared: 0,
    forceClosed: 0,
  });
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('flagged');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await listModerationJobs(token, {
        moderationStatus: filter,
        q: query,
        limit: 50,
      });
      setJobs(result.jobs);
      setCounts(result.counts);
      setError(null);
      setSelectedId((current) => {
        if (current && result.jobs.some((job) => job.id === current)) return current;
        return result.jobs[0]?.id ?? null;
      });
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load jobs for moderation.'
      );
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? null;

  const clearListing = async (id: string) => {
    const token = getStoredToken();
    const target = jobs.find((job) => job.id === id);
    if (!token || !target || target.moderationStatus !== 'flagged') return;

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await moderateJob(token, id, 'approve');
      setMessage(`“${target.title}” was cleared and published to job seekers.`);
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not clear this listing.'
      );
    } finally {
      setSaving(false);
    }
  };

  const forceCloseListing = async (id: string) => {
    const token = getStoredToken();
    const target = jobs.find((job) => job.id === id);
    if (!token || !target || target.moderationStatus !== 'flagged') return;

    if (!closeReason.trim()) {
      setMessage('Add a force-close reason before closing this listing.');
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await moderateJob(token, id, 'reject', closeReason.trim());
      setCloseReason('');
      setMessage(`“${target.title}” was force-closed and hidden from job seekers.`);
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not force-close this listing.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Job Moderation">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total reviewed set" value={counts.total} />
          <StatCard label="Flagged open" value={counts.flagged} />
          <StatCard label="Cleared" value={counts.cleared} />
          <StatCard label="Force-closed" value={counts.forceClosed} />
        </div>

        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-sm md:p-6">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Flagged & fake job posts
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
            >
              Review fake-job model results, then publish a listing to job seekers
              or force-close it. Flagged posts stay hidden on mobile until you act.
            </p>
          </div>

          <form
            className="mt-5 grid gap-3 md:grid-cols-[1fr_200px]"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(queryInput.trim());
            }}
          >
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search title, company, poster…"
              className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none transition focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </form>

          {error ? (
            <div
              className="mt-4 rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </div>
          ) : null}

          {message ? (
            <div
              className="mt-4 rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
            {loading ? (
              <p
                className="px-5 py-10 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Loading jobs...
              </p>
            ) : jobs.length === 0 ? (
              <p
                className="px-5 py-10 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                No job listings match your filters.
              </p>
            ) : (
              <ul className="divide-y divide-[#EEF0F8]">
                {jobs.map((job) => {
                  const active = selected?.id === job.id;
                  const score = scoreStyles(job.fakeJobScore);
                  return (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(job.id);
                          setCloseReason('');
                          setMessage(null);
                        }}
                        className={`w-full px-4 py-4 text-left transition ${
                          active ? 'bg-[#F7F8FE]' : 'hover:bg-[#FAFBFF]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-sm font-semibold"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {job.title}
                          </p>
                          <ModerationBadge status={job.moderationStatus} />
                        </div>
                        <p
                          className="mt-1 text-xs"
                          style={{
                            color: colors.muted,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {job.companyName} · {job.posterType}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              color: score.color,
                              backgroundColor: score.background,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {Math.round(job.fakeJobScore * 100)}% fake score
                          </span>
                          <span
                            className="text-[11px]"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {job.reportCount} reports
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-sm md:p-6">
            {!selected ? (
              <p
                className="py-16 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Select a flagged job to review signals and take action.
              </p>
            ) : (
              <JobDetail
                job={selected}
                closeReason={closeReason}
                saving={saving}
                onCloseReasonChange={setCloseReason}
                onClear={() => void clearListing(selected.id)}
                onForceClose={() => void forceCloseListing(selected.id)}
              />
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function JobDetail({
  job,
  closeReason,
  saving,
  onCloseReasonChange,
  onClear,
  onForceClose,
}: {
  job: ModeratedJobRecord;
  closeReason: string;
  saving: boolean;
  onCloseReasonChange: (value: string) => void;
  onClear: () => void;
  onForceClose: () => void;
}) {
  const score = scoreStyles(job.fakeJobScore);
  const flagged = job.moderationStatus === 'flagged';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className="text-xl font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {job.title}
          </h3>
          <p
            className="mt-1 text-sm"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            {job.companyName} · {job.location} · {job.mode} · {job.type}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ModerationBadge status={job.moderationStatus as JobModerationStatus} />
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
            style={{
              color:
                job.listingStatus === 'active'
                  ? '#2E7D32'
                  : job.listingStatus === 'pending_review'
                    ? '#EF6C00'
                    : '#C62828',
              backgroundColor:
                job.listingStatus === 'active'
                  ? '#E8F5E9'
                  : job.listingStatus === 'pending_review'
                    ? '#FFF3E0'
                    : '#FFEBEE',
              fontFamily: 'var(--font-poppins)',
            }}
          >
            Listing {job.listingStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      <p
        className="rounded-xl bg-[#F7F8FE] px-4 py-3 text-sm leading-relaxed"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {job.description}
      </p>

      {job.riskMessage ? (
        <p
          className="rounded-xl border border-[#FFE0B2] bg-[#FFF8E1] px-4 py-3 text-sm"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          {job.riskPrediction ? `${job.riskPrediction}: ` : ''}
          {job.riskMessage}
        </p>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailRow label="Salary" value={job.salaryLabel} />
        <DetailRow label="Applicants" value={String(job.applicants)} />
        <DetailRow
          label="Posted by"
          value={`${job.posterName} (${job.posterType})`}
        />
        <DetailRow label="Poster email" value={job.posterEmail} />
        <DetailRow label="Posted" value={formatDate(job.postedAt)} />
        <DetailRow label="Flagged" value={formatDate(job.flaggedAt)} />
        <DetailRow label="Reviewed" value={formatDate(job.reviewedAt)} />
        <DetailRow label="User reports" value={String(job.reportCount)} />
      </dl>

      <div>
        <h4
          className="text-sm font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Fake-job score
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              color: score.color,
              backgroundColor: score.background,
              fontFamily: 'var(--font-poppins)',
            }}
          >
            {score.label} · {Math.round(job.fakeJobScore * 100)}%
          </span>
          <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-[#EEF0F8]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(job.fakeJobScore * 100)}%`,
                backgroundColor: score.color,
              }}
            />
          </div>
        </div>
      </div>

      <div>
        <h4
          className="text-sm font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Flag reasons
        </h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {job.flagReasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-1 text-xs font-medium"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {FLAG_LABELS[reason] || reason}
            </span>
          ))}
        </div>
      </div>

      {job.moderationStatus === 'force_closed' && job.closeReason ? (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3">
          <p
            className="text-xs font-semibold uppercase tracking-wide text-[#C62828]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            Force-close reason
          </p>
          <p
            className="mt-1 text-sm text-[#C62828]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {job.closeReason}
          </p>
        </div>
      ) : null}

      {flagged ? (
        <div className="space-y-3 border-t border-[#EEF0F8] pt-5">
          <label className="block">
            <span
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Force-close reason (required to close)
            </span>
            <textarea
              value={closeReason}
              onChange={(event) => onCloseReasonChange(event.target.value)}
              rows={3}
              placeholder="Explain why this listing should be removed from the platform…"
              className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={onClear}
              className="rounded-xl bg-[#2E7D32] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-70"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {saving ? 'Saving…' : 'Approve & publish'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onForceClose}
              className="rounded-xl border border-[#FFCDD2] px-5 py-2.5 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFEBEE] disabled:opacity-70"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Force-close listing
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#EEF0F8] bg-white px-5 py-4 shadow-sm">
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </p>
    </div>
  );
}

function ModerationBadge({ status }: { status: string }) {
  const styles = moderationStyles(status as JobModerationStatus);
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: styles.color,
        backgroundColor: styles.background,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {styles.label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#EEF0F8] px-3 py-2.5">
      <dt
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 text-sm"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </dd>
    </div>
  );
}
