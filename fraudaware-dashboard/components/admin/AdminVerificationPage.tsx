'use client';

import { useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { MOCK_VERIFICATION_QUEUE } from '@/lib/admin/mockVerificationQueue';
import type {
  CompanyVerificationRequest,
  VerificationDecision,
} from '@/lib/admin/verificationTypes';
import { colors } from '@/lib/theme/colors';

type DecisionFilter = 'all' | VerificationDecision;

const FILTER_OPTIONS: { value: DecisionFilter; label: string }[] = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
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

function riskLabel(score: number): { label: string; color: string; background: string } {
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

export default function AdminVerificationPage() {
  const [items, setItems] = useState<CompanyVerificationRequest[]>(
    MOCK_VERIFICATION_QUEUE
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DecisionFilter>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(
    MOCK_VERIFICATION_QUEUE.find((item) => item.decision === 'pending')?.id ??
      MOCK_VERIFICATION_QUEUE[0]?.id ??
      null
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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

  const selected =
    filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  const applyDecision = (
    id: string,
    decision: Extract<VerificationDecision, 'approved' | 'rejected'>,
    reason?: string
  ) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.decision !== 'pending') return;

    if (decision === 'rejected' && !reason?.trim()) {
      setMessage('Add a rejection reason before rejecting this company.');
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
              rejectionReason: decision === 'rejected' ? reason?.trim() ?? null : null,
            }
          : item
      )
    );
    setRejectionReason('');
    setMessage(
      decision === 'approved'
        ? `${target.companyName} was approved as a legitimate company.`
        : `${target.companyName} was rejected.`
    );
    setSelectedId(nextPending?.id ?? id);
  };

  return (
    <AdminShell title="Verification Queue">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total requests" value={counts.total} />
          <StatCard label="Pending review" value={counts.pending} />
          <StatCard label="Approved" value={counts.approved} />
          <StatCard label="Rejected" value={counts.rejected} />
        </div>

        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Company legitimacy
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Review registry signals and approve or reject company verification
                requests. Uses mock data for now.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_200px]">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, registration no., submitter…"
              className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none transition focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as DecisionFilter)}
              className="rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {message ? (
            <div
              className="mt-4 rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
            {filtered.length === 0 ? (
              <p
                className="px-5 py-10 text-center text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                No verification requests match your filters.
              </p>
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
                            {item.companyName}
                          </p>
                          <DecisionBadge decision={item.decision} />
                        </div>
                        <p
                          className="mt-1 text-xs"
                          style={{
                            color: colors.muted,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {item.registrationNumber} · {item.industry}
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
                            {risk.label} · {Math.round(item.riskScore * 100)}%
                          </span>
                          <span
                            className="text-[11px]"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {formatDate(item.submittedAt)}
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
                Select a company request to review legitimacy signals.
              </p>
            ) : (
              <VerificationDetail
                item={selected}
                rejectionReason={rejectionReason}
                onRejectionReasonChange={setRejectionReason}
                onApprove={() => applyDecision(selected.id, 'approved')}
                onReject={() =>
                  applyDecision(selected.id, 'rejected', rejectionReason)
                }
              />
            )}
          </div>
        </div>
      </div>
    </AdminShell>
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className="text-xl font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {item.companyName}
          </h3>
          <p
            className="mt-1 text-sm"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Reg. no. {item.registrationNumber}
            {item.website ? (
              <>
                {' · '}
                <a
                  href={item.website}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
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

      <p
        className="rounded-xl bg-[#F7F8FE] px-4 py-3 text-sm leading-relaxed"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {item.summary}
      </p>

      <dl className="grid gap-3 sm:grid-cols-2">
        <DetailRow label="Industry" value={item.industry} />
        <DetailRow label="Address" value={item.address} />
        <DetailRow label="Submitted by" value={item.submittedByName} />
        <DetailRow label="Submitter email" value={item.submittedByEmail} />
        <DetailRow label="Submitted" value={formatDate(item.submittedAt)} />
        <DetailRow label="Reviewed" value={formatDate(item.reviewedAt)} />
      </dl>

      <div>
        <h4
          className="text-sm font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Registry signals
        </h4>
        <ul className="mt-3 space-y-2">
          {item.registrySignals.map((signal) => (
            <li
              key={`${item.id}-${signal.source}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-[#EEF0F8] px-3 py-2.5"
            >
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
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
      </div>

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

      {pending ? (
        <div className="space-y-3 border-t border-[#EEF0F8] pt-5">
          <label className="block">
            <span
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Rejection reason (required to reject)
            </span>
            <textarea
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              rows={3}
              placeholder="Explain why this company failed legitimacy checks…"
              className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onApprove}
              className="rounded-xl bg-[#2E7D32] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Approve legitimacy
            </button>
            <button
              type="button"
              onClick={onReject}
              className="rounded-xl border border-[#FFCDD2] px-5 py-2.5 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFEBEE]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Reject
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

function DecisionBadge({ decision }: { decision: VerificationDecision }) {
  const styles = decisionStyles(decision);
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
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
        className="mt-1 text-sm"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </dd>
    </div>
  );
}
