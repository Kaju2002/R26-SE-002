'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  PlatformReport,
  ReportReasonCode,
  ReportStatus,
  ReportTargetType,
} from '@/lib/admin/reportTypes';
import {
  flagJobFromPlatformReport,
  listPlatformReports,
  updatePlatformReport,
  type PlatformReportRecord,
} from '@/lib/api/jobApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type StatusFilter = 'all' | ReportStatus;

const REASON_LABELS: Record<ReportReasonCode, string> = {
  fake_job: 'Fake job',
  payment_request: 'Payment request',
  harassment: 'Harassment',
  spam: 'Spam',
  impersonation: 'Impersonation',
  other: 'Other',
};

const TARGET_LABELS: Record<ReportTargetType, string> = {
  job: 'Job',
  user: 'User',
  company: 'Company',
  message: 'Message',
};

function mapReport(record: PlatformReportRecord): PlatformReport {
  return {
    id: record.id,
    targetType: (record.targetType as ReportTargetType) || 'job',
    targetId: record.targetId,
    targetLabel: record.targetLabel,
    reporterName: record.reporterName,
    reporterEmail: record.reporterEmail,
    reasonCode: (record.reasonCode as ReportReasonCode) || 'other',
    details: record.details || '',
    status: (record.status as ReportStatus) || 'new',
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt ?? null,
    adminNote: record.adminNote ?? null,
  };
}

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

function formatRelative(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusStyles(status: ReportStatus): {
  color: string;
  background: string;
  label: string;
} {
  if (status === 'new') {
    return { color: '#EF6C00', background: '#FFF3E0', label: 'New' };
  }
  if (status === 'reviewing') {
    return { color: '#1565C0', background: '#E3F2FD', label: 'Reviewing' };
  }
  if (status === 'resolved') {
    return { color: '#2E7D32', background: '#E8F5E9', label: 'Resolved' };
  }
  return { color: '#616161', background: '#F5F5F5', label: 'Dismissed' };
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlatformReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('new');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadReports = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in as super admin to load reports.');
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listPlatformReports(token, { limit: 100 });
      setItems(result.reports.map(mapReport));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load reports'
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const counts = useMemo(
    () => ({
      total: items.length,
      new: items.filter((item) => item.status === 'new').length,
      reviewing: items.filter((item) => item.status === 'reviewing').length,
      resolved: items.filter((item) => item.status === 'resolved').length,
      dismissed: items.filter((item) => item.status === 'dismissed').length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!q) return true;
      const haystack = [
        item.targetLabel,
        item.reporterName,
        item.reporterEmail,
        item.reasonCode,
        item.details,
        item.id,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, filter]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selected) {
      setAdminNote('');
      return;
    }
    setAdminNote(selected.adminNote ?? '');
  }, [selected]);

  const openReport = (id: string) => {
    setSelectedId(id);
    setMessage(null);
    setError(null);
  };

  const updateStatus = async (
    id: string,
    status: Extract<ReportStatus, 'reviewing' | 'resolved' | 'dismissed'>
  ) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;

    if (
      (status === 'resolved' || status === 'dismissed') &&
      !adminNote.trim()
    ) {
      setError('Add an admin note before resolving or dismissing.');
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setError('Sign in as super admin to update reports.');
      return;
    }

    setError(null);
    setActionBusy(true);
    try {
      const updated = await updatePlatformReport(token, id, {
        status,
        adminNote:
          status === 'reviewing' ? undefined : adminNote.trim() || undefined,
      });
      const mapped = mapReport(updated);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? mapped : item))
      );
      setMessage(
        status === 'reviewing'
          ? `Marked “${target.targetLabel}” as reviewing.`
          : status === 'resolved'
            ? `Resolved report on “${target.targetLabel}”.`
            : `Dismissed report on “${target.targetLabel}”.`
      );
      if (status === 'resolved' || status === 'dismissed') {
        setSelectedId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update report'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const openInJobs = async (id: string) => {
    const token = getStoredToken();
    const target = items.find((item) => item.id === id);
    if (!token || !target || target.targetType !== 'job') return;

    setActionBusy(true);
    setError(null);
    try {
      await flagJobFromPlatformReport(token, id);
      setSelectedId(null);
      setActionBusy(false);
      router.push(`/admin/jobs?q=${encodeURIComponent(target.targetId)}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not open job in moderation'
      );
      setActionBusy(false);
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
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label="New"
            count={counts.new}
            active={filter === 'new'}
            onClick={() => setFilter('new')}
            tone="new"
          />
          <FilterChip
            label="Reviewing"
            count={counts.reviewing}
            active={filter === 'reviewing'}
            onClick={() => setFilter('reviewing')}
            tone="reviewing"
          />
          <FilterChip
            label="Resolved"
            count={counts.resolved}
            active={filter === 'resolved'}
            onClick={() => setFilter('resolved')}
            tone="resolved"
          />
          <FilterChip
            label="Dismissed"
            count={counts.dismissed}
            active={filter === 'dismissed'}
            onClick={() => setFilter('dismissed')}
            tone="dismissed"
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
                <span className="sr-only">Search reports</span>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search target, reporter, reason…"
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
            <p
              className="shrink-0 text-xs"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              {loading
                ? 'Loading…'
                : `${filtered.length} shown · live reports`}
            </p>
          </div>

          {message ? (
            <div
              className="border-b border-[#C8E6C9] bg-[#E8F5E9] px-4 py-2.5 text-sm text-[#2E7D32] sm:px-5"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
            </div>
          ) : null}
          {error && !selectedId ? (
            <div
              className="border-b border-[#FFCDD2] bg-[#FFEBEE] px-4 py-2.5 text-sm text-[#C62828] sm:px-5"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <p
              className="px-5 py-16 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Loading reports…
            </p>
          ) : filtered.length === 0 ? (
            <p
              className="px-5 py-16 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              No reports match this filter.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#EEF0F8] bg-[#F7F8FE]">
                    <tr>
                      <Th>Target</Th>
                      <Th>Reason</Th>
                      <Th>Reporter</Th>
                      <Th>Status</Th>
                      <Th>Submitted</Th>
                      <Th className="text-right"> </Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF0F8]">
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer transition hover:bg-[#FAFBFF]"
                        onClick={() => openReport(item.id)}
                      >
                        <td className="px-5 py-3.5">
                          <p
                            className="max-w-[260px] truncate font-semibold"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {item.targetLabel}
                          </p>
                          <p
                            className="mt-0.5 text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {TARGET_LABELS[item.targetType]} · {item.id}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <ReasonPill reason={item.reasonCode} />
                        </td>
                        <td className="px-5 py-3.5">
                          <p
                            className="truncate text-sm"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {item.reporterName}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {item.reporterEmail}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={item.status} />
                        </td>
                        <td
                          className="whitespace-nowrap px-5 py-3.5 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {formatRelative(item.createdAt) ||
                            formatDate(item.createdAt)}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openReport(item.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#202871] hover:bg-[#F2F6FF]"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                          >
                            Review →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[#EEF0F8] md:hidden">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#FAFBFF]"
                      onClick={() => openReport(item.id)}
                    >
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{
                            color: colors.navy,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {item.targetLabel}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{
                            color: colors.muted,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {REASON_LABELS[item.reasonCode]} ·{' '}
                          {formatRelative(item.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {selected ? (
        <ReportDrawer
          report={selected}
          adminNote={adminNote}
          error={error}
          busy={actionBusy}
          onAdminNoteChange={(value) => {
            setAdminNote(value);
            setError(null);
          }}
          onClose={() => setSelectedId(null)}
          onStartReview={() => void updateStatus(selected.id, 'reviewing')}
          onResolve={() => void updateStatus(selected.id, 'resolved')}
          onDismiss={() => void updateStatus(selected.id, 'dismissed')}
          onOpenInJobs={() => void openInJobs(selected.id)}
        />
      ) : null}
    </>
  );
}

function ReportDrawer({
  report,
  adminNote,
  error,
  busy,
  onAdminNoteChange,
  onClose,
  onStartReview,
  onResolve,
  onDismiss,
  onOpenInJobs,
}: {
  report: PlatformReport;
  adminNote: string;
  error: string | null;
  busy: boolean;
  onAdminNoteChange: (value: string) => void;
  onClose: () => void;
  onStartReview: () => void;
  onResolve: () => void;
  onDismiss: () => void;
  onOpenInJobs: () => void;
}) {
  const open = report.status === 'new' || report.status === 'reviewing';
  const isJobReport = report.targetType === 'job';
  const relatedHref =
    report.targetType === 'company'
      ? '/admin/verification'
      : report.targetType === 'user'
        ? '/admin/users'
        : null;
  const detailsText = report.details?.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-drawer-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF0F8] px-5 py-4">
          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Report · {TARGET_LABELS[report.targetType]}
            </p>
            <h2
              id="report-drawer-title"
              className="mt-1 text-lg font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {report.targetLabel}
            </h2>
            {isJobReport ? (
              <button
                type="button"
                disabled={busy}
                onClick={onOpenInJobs}
                className="mt-2 text-sm font-semibold text-[#202871] underline-offset-2 hover:underline disabled:opacity-50"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {busy ? 'Opening…' : 'Open in Jobs →'}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-[#E5E7EE] px-3 py-1.5 text-sm font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={report.status} />
            <ReasonPill reason={report.reasonCode} />
          </div>

          <dl className="grid gap-2 sm:grid-cols-2">
            <DetailRow label="Report ID" value={report.id} mono />
            <DetailRow label="Target ID" value={report.targetId} mono />
            <DetailRow label="Reporter" value={report.reporterName} />
            <DetailRow label="Reporter email" value={report.reporterEmail} />
            <DetailRow label="Submitted" value={formatDate(report.createdAt)} />
            <DetailRow label="Resolved" value={formatDate(report.resolvedAt)} />
          </dl>

          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Message
            </h3>
            <p
              className="mt-2 whitespace-pre-wrap rounded-xl bg-[#F7F8FE] px-4 py-3 text-sm leading-relaxed"
              style={{
                color: detailsText ? colors.body : colors.muted,
                fontFamily: 'var(--font-poppins)',
              }}
            >
              {detailsText || 'No message from reporter.'}
            </p>
          </section>

          {relatedHref ? (
            <Link
              href={relatedHref}
              className="inline-flex text-sm font-semibold text-[#202871] underline-offset-2 hover:underline"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Open related {TARGET_LABELS[report.targetType].toLowerCase()} →
            </Link>
          ) : null}

          {report.adminNote && !open ? (
            <div className="rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-4 py-3">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                Admin note
              </p>
              <p
                className="mt-1 text-sm"
                style={{
                  color: colors.navy,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                {report.adminNote}
              </p>
            </div>
          ) : null}
        </div>

        {open ? (
          <div className="shrink-0 space-y-3 border-t border-[#EEF0F8] px-5 py-4">
            {error ? (
              <p
                className="text-sm text-[#C62828]"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {error}
              </p>
            ) : null}
            <label className="block">
              <span
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                Admin note (required to resolve / dismiss)
              </span>
              <textarea
                value={adminNote}
                onChange={(event) => onAdminNoteChange(event.target.value)}
                rows={3}
                placeholder="What did you check? What action did you take?"
                className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
                style={{
                  color: colors.navy,
                  fontFamily: 'var(--font-poppins)',
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {report.status === 'new' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onStartReview}
                  className="rounded-xl border border-[#BBDEFB] bg-[#E3F2FD] px-4 py-2.5 text-sm font-semibold text-[#1565C0] disabled:opacity-50"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Start review
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={onResolve}
                className="rounded-xl bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Resolve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDismiss}
                className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold text-[#616161] disabled:opacity-50"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          <div
            className="shrink-0 border-t border-[#EEF0F8] px-5 py-3 text-xs"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Case closed
            {report.resolvedAt ? ` · ${formatDate(report.resolvedAt)}` : ''}.
          </div>
        )}
      </aside>
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
  tone?: ReportStatus;
}) {
  if (tone && !active) {
    const styles = statusStyles(tone);
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold"
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active
          ? 'border-[#202871] bg-[#202871] text-white'
          : 'border-[#E5E7EE] bg-white text-[#202871] hover:bg-[#F7F8FE]'
      }`}
      style={{ fontFamily: 'var(--font-poppins)' }}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          active ? 'bg-white/20' : 'bg-[#F2F6FF]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const styles = statusStyles(status);
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
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

function ReasonPill({ reason }: { reason: ReportReasonCode }) {
  return (
    <span
      className="inline-flex rounded-full bg-[#F2F6FF] px-2.5 py-1 text-xs font-semibold"
      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
    >
      {REASON_LABELS[reason]}
    </span>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#EEF0F8] px-3 py-2.5">
      <dt
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </dt>
      <dd
        className={`mt-1 break-all text-sm ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value?.trim() ? value : '—'}
      </dd>
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wide ${className}`}
      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
    >
      {children}
    </th>
  );
}
