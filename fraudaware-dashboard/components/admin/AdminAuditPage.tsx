'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { MOCK_AUDIT_LOG } from '@/lib/admin/mockAuditLog';
import type {
  AuditAction,
  AuditLogEntry,
  AuditTargetType,
} from '@/lib/admin/auditTypes';
import { colors } from '@/lib/theme/colors';

type ActionFilter = 'all' | AuditAction;
type TargetFilter = 'all' | AuditTargetType;

const ACTION_LABELS: Record<AuditAction, string> = {
  'user.suspend': 'Suspend user',
  'user.ban': 'Ban user',
  'user.restore': 'Restore user',
  'company.verify.approve': 'Approve company',
  'company.verify.reject': 'Reject company',
  'job.clear': 'Clear job',
  'job.force_close': 'Force-close job',
  'report.resolve': 'Resolve report',
  'report.dismiss': 'Dismiss report',
};

const TARGET_LABELS: Record<AuditTargetType, string> = {
  user: 'User',
  company: 'Company',
  job: 'Job',
  report: 'Report',
};

const ACTION_OPTIONS: { value: ActionFilter; label: string }[] = [
  { value: 'all', label: 'All actions' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({
    value: value as AuditAction,
    label,
  })),
];

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

function actionTone(action: AuditAction): {
  color: string;
  background: string;
} {
  if (action.includes('ban') || action.includes('force_close') || action.includes('reject')) {
    return { color: '#C62828', background: '#FFEBEE' };
  }
  if (action.includes('suspend') || action.includes('dismiss')) {
    return { color: '#EF6C00', background: '#FFF3E0' };
  }
  if (
    action.includes('approve') ||
    action.includes('clear') ||
    action.includes('restore') ||
    action.includes('resolve')
  ) {
    return { color: '#2E7D32', background: '#E8F5E9' };
  }
  return { color: colors.navy, background: '#F2F6FF' };
}

function targetHref(entry: AuditLogEntry): string | null {
  if (entry.targetType === 'user') return '/admin/users';
  if (entry.targetType === 'company') return '/admin/verification';
  if (entry.targetType === 'job') return '/admin/jobs';
  if (entry.targetType === 'report') return '/admin/reports';
  return null;
}

function toCsv(rows: AuditLogEntry[]): string {
  const header = [
    'id',
    'createdAt',
    'actorName',
    'actorEmail',
    'action',
    'targetType',
    'targetId',
    'targetLabel',
    'summary',
    'note',
    'before',
    'after',
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = rows.map((row) =>
    [
      row.id,
      row.createdAt,
      row.actorName,
      row.actorEmail,
      row.action,
      row.targetType,
      row.targetId,
      row.targetLabel,
      row.summary,
      row.note ?? '',
      JSON.stringify(row.before),
      JSON.stringify(row.after),
    ]
      .map((cell) => escape(String(cell)))
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export default function AdminAuditPage() {
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_AUDIT_LOG.filter((item) => {
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;
      if (targetFilter !== 'all' && item.targetType !== targetFilter) return false;
      if (!q) return true;
      const haystack = [
        item.id,
        item.actorName,
        item.actorEmail,
        item.action,
        item.targetLabel,
        item.targetId,
        item.summary,
        item.note ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, actionFilter, targetFilter]);

  const selected = MOCK_AUDIT_LOG.find((item) => item.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const byTarget = { user: 0, company: 0, job: 0, report: 0 };
    for (const item of MOCK_AUDIT_LOG) {
      byTarget[item.targetType] += 1;
    }
    return {
      total: MOCK_AUDIT_LOG.length,
      ...byTarget,
    };
  }, []);

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

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fraudaware-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            count={counts.total}
            active={targetFilter === 'all'}
            onClick={() => setTargetFilter('all')}
          />
          <FilterChip
            label="Users"
            count={counts.user}
            active={targetFilter === 'user'}
            onClick={() => setTargetFilter('user')}
          />
          <FilterChip
            label="Companies"
            count={counts.company}
            active={targetFilter === 'company'}
            onClick={() => setTargetFilter('company')}
          />
          <FilterChip
            label="Jobs"
            count={counts.job}
            active={targetFilter === 'job'}
            onClick={() => setTargetFilter('job')}
          />
          <FilterChip
            label="Reports"
            count={counts.report}
            active={targetFilter === 'report'}
            onClick={() => setTargetFilter('report')}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#EEF0F8] px-4 py-3 sm:px-5">
            <form
              className="grid gap-2 md:grid-cols-[1fr_200px_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(queryInput.trim());
              }}
            >
              <label className="block min-w-0">
                <span className="sr-only">Search audit log</span>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search admin, action, target…"
                  className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
                  style={{
                    color: colors.navy,
                    fontFamily: 'var(--font-poppins)',
                  }}
                />
              </label>
              <select
                value={actionFilter}
                onChange={(event) =>
                  setActionFilter(event.target.value as ActionFilter)
                }
                className="rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-xl bg-[#202871] px-4 py-2 text-sm font-semibold text-white"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Search
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Export CSV
              </button>
            </form>
            <p
              className="text-xs"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              {filtered.length} events · read-only · mock data
            </p>
          </div>

          {filtered.length === 0 ? (
            <p
              className="px-5 py-16 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              No audit events match your filters.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#EEF0F8] bg-[#F7F8FE]">
                    <tr>
                      <Th>When</Th>
                      <Th>Admin</Th>
                      <Th>Action</Th>
                      <Th>Target</Th>
                      <Th>Summary</Th>
                      <Th className="text-right"> </Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF0F8]">
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer transition hover:bg-[#FAFBFF]"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <td
                          className="whitespace-nowrap px-5 py-3.5 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          <span className="block font-medium text-[#202871]">
                            {formatRelative(item.createdAt) ||
                              formatDate(item.createdAt)}
                          </span>
                          <span className="text-xs text-[#858BBD]">
                            {formatDate(item.createdAt)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p
                            className="font-semibold"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {item.actorName}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {item.actorEmail}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <ActionBadge action={item.action} />
                        </td>
                        <td className="px-5 py-3.5">
                          <p
                            className="max-w-[220px] truncate font-medium"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {item.targetLabel}
                          </p>
                          <p
                            className="text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {TARGET_LABELS[item.targetType]} · {item.targetId}
                          </p>
                        </td>
                        <td
                          className="max-w-[280px] truncate px-5 py-3.5 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {item.summary}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#202871] hover:bg-[#F2F6FF]"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                          >
                            Details →
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
                      className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-[#FAFBFF]"
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{
                            color: colors.navy,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {item.targetLabel}
                        </p>
                        <ActionBadge action={item.action} />
                      </div>
                      <p
                        className="text-xs"
                        style={{
                          color: colors.muted,
                          fontFamily: 'var(--font-poppins)',
                        }}
                      >
                        {item.actorName} · {formatRelative(item.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {selected ? (
        <AuditDrawer entry={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}

function AuditDrawer({
  entry,
  onClose,
}: {
  entry: AuditLogEntry;
  onClose: () => void;
}) {
  const related = targetHref(entry);

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
        aria-labelledby="audit-drawer-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF0F8] px-5 py-4">
          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Audit event
            </p>
            <h2
              id="audit-drawer-title"
              className="mt-1 text-lg font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {ACTION_LABELS[entry.action]}
            </h2>
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
          <ActionBadge action={entry.action} />

          <p
            className="text-sm leading-relaxed"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            {entry.summary}
          </p>

          <dl className="grid gap-2 sm:grid-cols-2">
            <DetailRow label="Event ID" value={entry.id} mono />
            <DetailRow label="When" value={formatDate(entry.createdAt)} />
            <DetailRow label="Admin" value={entry.actorName} />
            <DetailRow label="Admin email" value={entry.actorEmail} />
            <DetailRow
              label="Target type"
              value={TARGET_LABELS[entry.targetType]}
            />
            <DetailRow label="Target ID" value={entry.targetId} mono />
          </dl>

          <DetailRow label="Target" value={entry.targetLabel} />

          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Before → after
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <JsonCard title="Before" data={entry.before} />
              <JsonCard title="After" data={entry.after} />
            </div>
          </section>

          {entry.note ? (
            <div className="rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-4 py-3">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                Note / reason
              </p>
              <p
                className="mt-1 text-sm"
                style={{
                  color: colors.navy,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                {entry.note}
              </p>
            </div>
          ) : null}

          {related ? (
            <Link
              href={related}
              className="inline-flex rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm font-semibold text-[#202871] hover:bg-[#F7F8FE]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Open related {TARGET_LABELS[entry.targetType].toLowerCase()} queue
              →
            </Link>
          ) : null}
        </div>

        <div
          className="shrink-0 border-t border-[#EEF0F8] px-5 py-3 text-xs"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          Read-only audit trail · events cannot be edited
        </div>
      </aside>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
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

function ActionBadge({ action }: { action: AuditAction }) {
  const tone = actionTone(action);
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: tone.color,
        backgroundColor: tone.background,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {ACTION_LABELS[action]}
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

function JsonCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, string | number | boolean | null>;
}) {
  const entries = Object.entries(data);
  return (
    <div className="rounded-xl border border-[#EEF0F8] px-3 py-2.5">
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {title}
      </p>
      {entries.length === 0 ? (
        <p
          className="mt-2 text-sm"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          —
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {entries.map(([key, value]) => (
            <li
              key={key}
              className="flex justify-between gap-2 text-xs"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              <span style={{ color: colors.muted }}>{key}</span>
              <span className="font-semibold text-[#202871]">
                {value === null ? 'null' : String(value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children?: ReactNode;
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
