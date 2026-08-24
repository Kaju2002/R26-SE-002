'use client';

import { useEffect, useMemo, useState } from 'react';
import { MOCK_VERIFICATION_QUEUE } from '@/lib/admin/mockVerificationQueue';
import type {
  CompanyVerificationRequest,
  VerificationDecision,
} from '@/lib/admin/verificationTypes';
import { colors } from '@/lib/theme/colors';

type DecisionFilter = 'all' | VerificationDecision;

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

function riskLabel(score: number): {
  label: string;
  color: string;
  background: string;
} {
  if (score < 0.3) {
    return { label: 'Low risk', color: '#2E7D32', background: '#E8F5E9' };
  }
  if (score < 0.6) {
    return { label: 'Medium risk', color: '#EF6C00', background: '#FFF3E0' };
  }
  return { label: 'High risk', color: '#C62828', background: '#FFEBEE' };
}

function decisionStyles(decision: VerificationDecision): {
  color: string;
  background: string;
} {
  if (decision === 'approved') return { color: '#2E7D32', background: '#E8F5E9' };
  if (decision === 'rejected') return { color: '#C62828', background: '#FFEBEE' };
  return { color: '#EF6C00', background: '#FFF3E0' };
}

function companyInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'C'
  );
}

export default function AdminVerificationPage() {
  const [items, setItems] = useState<CompanyVerificationRequest[]>(
    MOCK_VERIFICATION_QUEUE
  );
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DecisionFilter>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(
    MOCK_VERIFICATION_QUEUE.find((item) => item.decision === 'pending')?.id ??
      MOCK_VERIFICATION_QUEUE[0]?.id ??
      null
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((item) => item.decision === 'pending').length,
      approved: items.filter((item) => item.decision === 'approved').length,
      rejected: items.filter((item) => item.decision === 'rejected').length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.decision !== filter) return false;
      if (!q) return true;
      const haystack = [
        item.companyName,
        item.registrationNumber,
        item.submittedByName,
        item.submittedByEmail,
        item.industry,
        item.address,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, filter]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
      setRejectionReason('');
    }
  }, [filtered, selectedId]);

  const selected =
    filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  const applyFilter = (next: DecisionFilter) => {
    setFilter(next);
    setMessage(null);
    setError(null);
  };

  const applyDecision = (
    id: string,
    decision: Extract<VerificationDecision, 'approved' | 'rejected'>,
    reason?: string
  ) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.decision !== 'pending') return;

    if (decision === 'rejected' && !reason?.trim()) {
      setError('Add a rejection reason before rejecting.');
      setMessage(null);
      return;
    }

    const nextPending = items.find(
      (item) => item.id !== id && item.decision === 'pending'
    );

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              decision,
              reviewedAt: new Date().toISOString(),
              rejectionReason:
                decision === 'rejected' ? reason?.trim() ?? null : null,
            }
          : item
      )
    );
    setRejectionReason('');
    setError(null);
    setMessage(
      decision === 'approved'
        ? `${target.companyName} approved.`
        : `${target.companyName} rejected.`
    );
    setSelectedId(nextPending?.id ?? id);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Compact filter chips — same pattern as Users */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            count={counts.total}
            active={filter === 'all'}
            onClick={() => applyFilter('all')}
          />
          <FilterChip
            label="Pending"
            count={counts.pending}
            active={filter === 'pending'}
            onClick={() => applyFilter('pending')}
            tone="pending"
          />
          <FilterChip
            label="Approved"
            count={counts.approved}
            active={filter === 'approved'}
            onClick={() => applyFilter('approved')}
            tone="approved"
          />
          <FilterChip
            label="Rejected"
            count={counts.rejected}
            active={filter === 'rejected'}
            onClick={() => applyFilter('rejected')}
            tone="rejected"
          />
        </div>

        {/* One workspace: search + queue + review panel */}
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
                <span className="sr-only">Search verification requests</span>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search company, reg. no., submitter…"
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
              {filtered.length} in queue
              {filter !== 'all' ? ` · ${filter}` : ''}
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
          {error ? (
            <div
              className="border-b border-[#FFCDD2] bg-[#FFEBEE] px-4 py-2.5 text-sm text-[#C62828] sm:px-5"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </div>
          ) : null}

          <div className="grid lg:grid-cols-[minmax(280px,38%)_minmax(0,1fr)]">
            {/* Left: queue */}
            <div className="max-h-[min(70vh,720px)] overflow-y-auto border-b border-[#EEF0F8] lg:border-b-0 lg:border-r">
              {filtered.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: colors.navy,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    No requests found
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
                  {filtered.map((item) => {
                    const active = selected?.id === item.id;
                    const risk = riskLabel(item.riskScore);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(item.id);
                            setRejectionReason('');
                            setMessage(null);
                            setError(null);
                          }}
                          className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition sm:px-5 ${
                            active
                              ? 'border-l-[3px] border-l-[#202871] bg-[#F7F8FE]'
                              : 'border-l-[3px] border-l-transparent hover:bg-[#FAFBFF]'
                          }`}
                        >
                          <CompanyMark name={item.companyName} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className="truncate text-sm font-semibold"
                                style={{
                                  color: colors.navy,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {item.companyName}
                              </p>
                              <DecisionBadge decision={item.decision} />
                            </div>
                            <p
                              className="mt-0.5 truncate text-xs"
                              style={{
                                color: colors.muted,
                                fontFamily: 'var(--font-poppins)',
                              }}
                            >
                              {item.registrationNumber}
                              {item.industry ? ` · ${item.industry}` : ''}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                  color: risk.color,
                                  backgroundColor: risk.background,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {risk.label} ·{' '}
                                {Math.round(item.riskScore * 100)}%
                              </span>
                              <span
                                className="text-[11px]"
                                style={{
                                  color: colors.muted,
                                  fontFamily: 'var(--font-poppins)',
                                }}
                              >
                                {formatDateShort(item.submittedAt)}
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

            {/* Right: review panel */}
            <div className="flex max-h-[min(70vh,720px)] min-h-[420px] flex-col">
              {!selected ? (
                <p
                  className="m-auto px-6 py-16 text-center text-sm"
                  style={{
                    color: colors.muted,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  Select a company from the queue to review.
                </p>
              ) : (
                <VerificationDetail
                  item={selected}
                  rejectionReason={rejectionReason}
                  onRejectionReasonChange={(value) => {
                    setRejectionReason(value);
                    setError(null);
                  }}
                  onApprove={() => applyDecision(selected.id, 'approved')}
                  onReject={() =>
                    applyDecision(selected.id, 'rejected', rejectionReason)
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function VerificationDetail({
  item,
  rejectionReason,
  onRejectionReasonChange,
  onApprove,
  onReject,
}: {
  item: CompanyVerificationRequest;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const risk = riskLabel(item.riskScore);
  const pending = item.decision === 'pending';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {/* 1. Identity */}
        <section>
          <div className="flex items-start gap-3">
            <CompanyMark name={item.companyName} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    className="truncate text-lg font-semibold"
                    style={{
                      color: colors.navy,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    {item.companyName}
                  </h3>
                  <p
                    className="mt-0.5 text-sm"
                    style={{
                      color: colors.body,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    Reg. {item.registrationNumber}
                    {item.website ? (
                      <>
                        {' · '}
                        <a
                          href={item.website}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#202871] underline-offset-2 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Website
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DecisionBadge decision={item.decision} />
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      color: risk.color,
                      backgroundColor: risk.background,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    {risk.label} · {Math.round(item.riskScore * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            <DetailRow label="Industry" value={item.industry} />
            <DetailRow label="Address" value={item.address} />
            <DetailRow label="Submitted by" value={item.submittedByName} />
            <DetailRow label="Submitter email" value={item.submittedByEmail} />
            <DetailRow label="Submitted" value={formatDate(item.submittedAt)} />
            <DetailRow label="Reviewed" value={formatDate(item.reviewedAt)} />
          </dl>
        </section>

        {/* 2. Registry signals */}
        <section>
          <h4
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Registry signals
          </h4>
          <ul className="mt-2 space-y-2">
            {item.registrySignals.map((signal) => (
              <li
                key={`${item.id}-${signal.source}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#EEF0F8] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: colors.navy,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    {signal.source}
                  </p>
                  {signal.note ? (
                    <p
                      className="mt-0.5 text-xs"
                      style={{
                        color: colors.muted,
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      {signal.note}
                    </p>
                  ) : null}
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    color: signal.found ? '#2E7D32' : '#C62828',
                    backgroundColor: signal.found ? '#E8F5E9' : '#FFEBEE',
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  {signal.found ? 'Match' : 'No match'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. AI / system summary */}
        <section>
          <h4
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            System summary
          </h4>
          <p
            className="mt-2 rounded-xl bg-[#F7F8FE] px-4 py-3 text-sm leading-relaxed"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            {item.summary}
          </p>
        </section>

        {item.decision === 'rejected' && item.rejectionReason ? (
          <div className="rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3">
            <p
              className="text-xs font-semibold uppercase tracking-wide text-[#C62828]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Rejection reason
            </p>
            <p
              className="mt-1 text-sm text-[#C62828]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {item.rejectionReason}
            </p>
          </div>
        ) : null}
      </div>

      {/* 4. Sticky actions */}
      {pending ? (
        <div className="shrink-0 space-y-3 border-t border-[#EEF0F8] bg-white px-4 py-4 sm:px-6">
          <label className="block">
            <span
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Rejection reason (required to reject)
            </span>
            <textarea
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              rows={2}
              placeholder="Why this company failed legitimacy checks…"
              className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="rounded-xl bg-[#2E7D32] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] px-5 py-2.5 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFEBEE]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div
          className="shrink-0 border-t border-[#EEF0F8] px-4 py-3 text-xs sm:px-6"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          Decision already recorded
          {item.reviewedAt ? ` · ${formatDate(item.reviewedAt)}` : ''}.
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
  tone?: VerificationDecision;
}) {
  if (tone && !active) {
    const styles = decisionStyles(tone);
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

function CompanyMark({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-[11px]';
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]`}
    >
      <span
        className="font-bold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {companyInitials(name)}
      </span>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: VerificationDecision }) {
  const styles = decisionStyles(decision);
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
      style={{
        color: styles.color,
        backgroundColor: styles.background,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {decision}
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
