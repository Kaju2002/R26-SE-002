'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { JobModerationStatus } from '@/lib/admin/jobModerationTypes';
import {
  listModerationJobs,
  moderateJob,
  type ExplanationHighlight,
  type ModeratedJobRecord,
} from '@/lib/api/jobApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type StatusFilter = 'all' | JobModerationStatus;

const FLAG_LABELS: Record<string, string> = {
  fake_job_model: 'Fake listing text',
  fake_job_poster: 'Fake job poster',
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

function formatDateShort(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPercent(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : 'n/a';
}

function percentWidth(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value * 100), 0), 100);
}

function predictionStyles(prediction?: string | null): {
  label: string;
  color: string;
  background: string;
  bar: string;
} {
  const value = String(prediction || 'unknown').toLowerCase();
  if (value === 'legitimate') {
    return {
      label: 'Legitimate',
      color: '#2E7D32',
      background: '#E8F5E9',
      bar: '#2E7D32',
    };
  }
  if (value === 'suspicious') {
    return {
      label: 'Suspicious',
      color: '#EF6C00',
      background: '#FFF3E0',
      bar: '#EF6C00',
    };
  }
  if (value === 'fake') {
    return {
      label: 'Fake',
      color: '#C62828',
      background: '#FFEBEE',
      bar: '#C62828',
    };
  }
  if (value === 'skipped') {
    return {
      label: 'Skipped',
      color: '#5C6378',
      background: '#EEF0F8',
      bar: '#C9D2E0',
    };
  }
  return {
    label: value === 'error' ? 'Unavailable' : 'Unknown',
    color: '#5C6378',
    background: '#EEF0F8',
    bar: '#9AA3B8',
  };
}

function PredictionBadge({ prediction }: { prediction?: string | null }) {
  const tone = predictionStyles(prediction);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
      style={{
        color: tone.color,
        backgroundColor: tone.background,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {tone.label}
    </span>
  );
}

function RiskMeter({
  label,
  prediction,
  fakeProbability,
}: {
  label: string;
  prediction?: string | null;
  fakeProbability?: number | null;
}) {
  const tone = predictionStyles(prediction);
  const width = percentWidth(fakeProbability);

  return (
    <div className="rounded-xl border border-[#EEF0F8] bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-xs font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {label}
        </p>
        <PredictionBadge prediction={prediction} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p
          className="text-2xl font-semibold leading-none"
          style={{ color: tone.color, fontFamily: 'var(--font-poppins)' }}
        >
          {formatPercent(fakeProbability)}
        </p>
        <p
          className="text-[11px]"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          fake probability
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEF0F8]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${width}%`, backgroundColor: tone.bar }}
        />
      </div>
    </div>
  );
}

function HighlightChips({
  title,
  items,
}: {
  title: string;
  items?: ExplanationHighlight[] | null;
}) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {title}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => {
          const towardFake = item.toward !== 'legitimate';
          return (
            <span
              key={`${title}-${item.token}-${item.weight}`}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                color: towardFake ? '#C62828' : '#2E7D32',
                backgroundColor: towardFake ? '#FFEBEE' : '#E8F5E9',
                fontFamily: 'var(--font-poppins)',
              }}
            >
              {item.token} {item.weight >= 0 ? '+' : ''}
              {item.weight.toFixed(2)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function moderationStyles(status: string): {
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

function listingStyles(status: string): { color: string; background: string } {
  if (status === 'active') return { color: '#2E7D32', background: '#E8F5E9' };
  if (status === 'pending_review')
    return { color: '#EF6C00', background: '#FFF3E0' };
  return { color: '#C62828', background: '#FFEBEE' };
}

export default function AdminJobsModerationPage() {
  const searchParams = useSearchParams();
  const initialQ = (searchParams.get('q') || '').trim();

  const [jobs, setJobs] = useState<ModeratedJobRecord[]>([]);
  const [counts, setCounts] = useState({
    total: 0,
    flagged: 0,
    cleared: 0,
    forceClosed: 0,
  });
  const [queryInput, setQueryInput] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const [filter, setFilter] = useState<StatusFilter>(
    initialQ ? 'all' : 'flagged'
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = (searchParams.get('q') || '').trim();
    if (!next) return;
    setQueryInput(next);
    setQuery(next);
    setFilter('all');
  }, [searchParams]);

  const reload = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in as a super admin to moderate jobs.');
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
        const fromUrl = (searchParams.get('q') || '').trim();
        if (fromUrl) {
          const match = result.jobs.find(
            (job) =>
              job.id === fromUrl ||
              job.title.toLowerCase().includes(fromUrl.toLowerCase()) ||
              job.companyName.toLowerCase().includes(fromUrl.toLowerCase())
          );
          if (match) return match.id;
        }
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
  }, [filter, query, searchParams]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? null;

  const applyFilter = (next: StatusFilter) => {
    setFilter(next);
    setMessage(null);
    setError(null);
    setCloseReason('');
  };

  const clearListing = async (id: string) => {
    const token = getStoredToken();
    const target = jobs.find((job) => job.id === id);
    if (!token || !target || target.moderationStatus !== 'flagged') return;

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await moderateJob(token, id, 'approve');
      setMessage(`“${target.title}” cleared and published.`);
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not clear this listing.'
      );
    } finally {
      setSaving(false);
    }
  };

  const forceCloseListing = async (id: string) => {
    const token = getStoredToken();
    const target = jobs.find((job) => job.id === id);
    if (
      !token ||
      !target ||
      (target.moderationStatus !== 'flagged' &&
        target.moderationStatus !== 'cleared')
    ) {
      return;
    }

    if (!closeReason.trim()) {
      setError('Add a force-close reason before closing.');
      setMessage(null);
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await moderateJob(token, id, 'reject', closeReason.trim());
      setCloseReason('');
      setMessage(`“${target.title}” force-closed.`);
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
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            count={counts.total}
            active={filter === 'all'}
            onClick={() => applyFilter('all')}
          />
          <FilterChip
            label="Flagged"
            count={counts.flagged}
            active={filter === 'flagged'}
            onClick={() => applyFilter('flagged')}
            tone="flagged"
          />
          <FilterChip
            label="Cleared"
            count={counts.cleared}
            active={filter === 'cleared'}
            onClick={() => applyFilter('cleared')}
            tone="cleared"
          />
          <FilterChip
            label="Force-closed"
            count={counts.forceClosed}
            active={filter === 'force_closed'}
            onClick={() => applyFilter('force_closed')}
            tone="force_closed"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#EEF0F8] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(queryInput.trim());
              }}
            >
              <label className="block min-w-0 flex-1">
                <span className="sr-only">Search jobs</span>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search title, company, poster…"
                  className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2 text-sm outline-none transition focus:border-[#202871]"
                  style={{
                    color: colors.navy,
                    fontFamily: 'var(--font-poppins)',
                  }}
                />
              </label>
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-[#202871] px-4 py-2 text-sm font-semibold text-white"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Search
              </button>
            </form>
            <div className="flex shrink-0 items-center gap-2">
              <p
                className="text-xs"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                {jobs.length} in queue
                {filter !== 'all' ? ` · ${filter.replace('_', ' ')}` : ''}
              </p>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={loading}
                className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          {message ? (
            <div
              className="border-b border-[#C8E6C9] bg-[#E8F5E9] px-4 py-2.5 text-sm text-[#2E7D32] sm:px-5"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
            </div>
          ) : null}
          {error ? (
            <div
              className="border-b border-[#FFCDD2] bg-[#FFEBEE] px-4 py-2.5 text-sm text-[#C62828] sm:px-5"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </div>
          ) : null}

          <div className="grid lg:grid-cols-[minmax(280px,38%)_minmax(0,1fr)]">
            <div className="max-h-[min(70vh,720px)] overflow-y-auto border-b border-[#EEF0F8] lg:border-b-0 lg:border-r">
              {loading && jobs.length === 0 ? (
                <p
                  className="px-5 py-16 text-center text-sm"
                  style={{
                    color: colors.muted,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  Loading jobs…
                </p>
              ) : jobs.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: colors.navy,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    No listings found
                  </p>
                  <p
                    className="mt-1 text-sm"
                    style={{
                      color: colors.muted,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    Try another search or switch filter chips.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#EEF0F8]">
                  {jobs.map((job) => {
                    const active = selected?.id === job.id;
                    const textTone = predictionStyles(job.textPrediction);
                    const posterTone = predictionStyles(job.imagePrediction);
                    return (
                      <li key={job.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(job.id);
                            setCloseReason('');
                            setMessage(null);
                            setError(null);
                          }}
                          className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition sm:px-5 ${
                            active
                              ? 'border-l-[3px] border-l-[#202871] bg-[#F7F8FE]'
                              : 'border-l-[3px] border-l-transparent hover:bg-[#FAFBFF]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className="line-clamp-2 text-sm font-semibold"
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
                              className="mt-0.5 truncate text-xs"
                              style={{
                                color: colors.muted,
                                fontFamily: 'var(--font-poppins)',
                              }}
                            >
                              {job.companyName} · {job.posterType}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                  color: textTone.color,
                                  backgroundColor: textTone.background,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                Text {formatPercent(job.textFakeProbability)}
                              </span>
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                  color: posterTone.color,
                                  backgroundColor: posterTone.background,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                Poster {formatPercent(job.imageFakeProbability)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className="text-[11px]"
                                style={{
                                  color: colors.muted,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {job.reportCount} reports
                              </span>
                              <span
                                className="text-[11px]"
                                style={{
                                  color: colors.muted,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {formatDateShort(job.flaggedAt || job.postedAt)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex max-h-[min(70vh,720px)] min-h-[420px] flex-col">
              {!selected ? (
                <p
                  className="m-auto px-6 py-16 text-center text-sm"
                  style={{
                    color: colors.muted,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  Select a listing from the queue to review.
                </p>
              ) : (
                <JobDetail
                  job={selected}
                  closeReason={closeReason}
                  saving={saving}
                  onCloseReasonChange={(value) => {
                    setCloseReason(value);
                    setError(null);
                  }}
                  onClear={() => void clearListing(selected.id)}
                  onForceClose={() => void forceCloseListing(selected.id)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
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
  const flagged = job.moderationStatus === 'flagged';
  const canForceClose =
    job.moderationStatus === 'flagged' || job.moderationStatus === 'cleared';
  const listing = listingStyles(job.listingStatus);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {/* 1. Identity */}
        <section>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="text-lg font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {job.title}
              </h3>
              <p
                className="mt-0.5 text-sm"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                {job.companyName} · {job.location} · {job.mode} · {job.type}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ModerationBadge status={job.moderationStatus} />
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
                style={{
                  color: listing.color,
                  backgroundColor: listing.background,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                Listing {job.listingStatus.replaceAll('_', ' ')}
              </span>
            </div>
          </div>

          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
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
        </section>

        {/* 2. Why flagged */}
        <section>
          <h4
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Fake-job check
          </h4>
          <div
            className="mt-2 rounded-xl px-4 py-3"
            style={{
              color: predictionStyles(job.riskPrediction).color,
              backgroundColor: predictionStyles(job.riskPrediction).background,
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Combined result
            </p>
            <p
              className="mt-1 text-sm font-semibold"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {predictionStyles(job.riskPrediction).label}
              {job.riskPrediction === 'fake' || job.riskPrediction === 'suspicious'
                ? ' — send to review / keep held'
                : job.riskPrediction === 'legitimate'
                  ? ' — both checks passed'
                  : ''}
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <RiskMeter
                label="Listing text"
                prediction={job.textPrediction}
                fakeProbability={job.textFakeProbability}
              />
              <div className="rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-3 py-3">
                <HighlightChips title="LIME" items={job.textLime} />
                <HighlightChips title="SHAP" items={job.textShap} />
                {!job.textLime?.length && !job.textShap?.length ? (
                  <p
                    className="text-[11px]"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    No text explanation yet. New posts include LIME and SHAP
                    highlights.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="space-y-1">
              <RiskMeter
                label="Job poster"
                prediction={job.imagePrediction}
                fakeProbability={job.imageFakeProbability}
              />
              <div className="rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-3 py-3">
                <HighlightChips title="LIME" items={job.imageLime} />
                <HighlightChips title="SHAP" items={job.imageShap} />
                {!job.imageLime?.length && !job.imageShap?.length ? (
                  <p
                    className="text-[11px]"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    No poster explanation yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <h4
            className="mt-4 text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Flag reasons
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {job.flagReasons.length === 0 ? (
              <span
                className="text-xs"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                No reasons recorded
              </span>
            ) : (
              job.flagReasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-1 text-xs font-medium"
                  style={{
                    color: colors.navy,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  {FLAG_LABELS[reason] || reason}
                </span>
              ))
            )}
          </div>

          {job.riskMessage ? (
            <p
              className="mt-3 rounded-xl border border-[#FFE0B2] bg-[#FFF8E1] px-4 py-3 text-sm"
              style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
            >
              {job.riskPrediction ? (
                <span className="font-semibold">{job.riskPrediction}: </span>
              ) : null}
              {job.riskMessage}
            </p>
          ) : null}
        </section>

        {/* 3. Description */}
        <section>
          <h4
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Job description
          </h4>
          <p
            className="mt-2 whitespace-pre-wrap rounded-xl bg-[#F7F8FE] px-4 py-3 text-sm leading-relaxed"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            {job.description?.trim() || '—'}
          </p>
        </section>

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
      </div>

      {/* 4. Sticky actions */}
      {flagged || canForceClose ? (
        <div className="shrink-0 space-y-3 border-t border-[#EEF0F8] bg-white px-4 py-4 sm:px-6">
          <label className="block">
            <span
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Force-close reason (required to close)
            </span>
            <textarea
              value={closeReason}
              onChange={(event) => onCloseReasonChange(event.target.value)}
              rows={2}
              placeholder="Why this listing should be removed…"
              className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {flagged ? (
              <button
                type="button"
                disabled={saving}
                onClick={onClear}
                className="rounded-xl bg-[#2E7D32] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-70"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {saving ? 'Saving…' : 'Clear & publish'}
              </button>
            ) : null}
            {canForceClose ? (
              <button
                type="button"
                disabled={saving}
                onClick={onForceClose}
                className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] px-5 py-2.5 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFEBEE] disabled:opacity-70"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Force-close
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className="shrink-0 border-t border-[#EEF0F8] px-4 py-3 text-xs sm:px-6"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          Decision already recorded
          {job.reviewedAt ? ` · ${formatDate(job.reviewedAt)}` : ''}.
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: JobModerationStatus;
}) {
  if (tone && !active) {
    const styles = moderationStyles(tone);
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
        style={{
          backgroundColor: styles.background,
          color: styles.color,
          fontFamily: 'var(--font-poppins)',
        }}
      >
        {label}
        <span className="font-bold">{count}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-[#202871] bg-[#202871] text-white'
          : 'border-[#E5E7EE] bg-white text-[#202871] hover:border-[#202871]/40 hover:bg-[#F7F8FE]'
      }`}
      style={{ fontFamily: 'var(--font-poppins)' }}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-[#F2F6FF] text-[#202871]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ModerationBadge({ status }: { status: string }) {
  const styles = moderationStyles(status);
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
        className="mt-1 break-words text-sm"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value?.trim() ? value : '—'}
      </dd>
    </div>
  );
}
