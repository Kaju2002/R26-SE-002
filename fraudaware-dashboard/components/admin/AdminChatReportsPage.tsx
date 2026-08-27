'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getChatReportDetail,
  listChatReports,
  updateChatReportStatus,
  type ChatReportDetail,
  type ChatReportListItem,
} from '@/lib/api/chatReportsApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const REASON_LABELS: Record<string, string> = {
  fake_job: 'Fake job',
  payment_request: 'Payment / fee ask',
  harassment: 'Harassment',
  spam: 'Spam',
  impersonation: 'Impersonation',
  other: 'Other',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusStyle(status: string) {
  if (status === 'new') return { color: '#EF6C00', background: '#FFF3E0', label: 'New' };
  if (status === 'reviewing') return { color: '#1565C0', background: '#E3F2FD', label: 'Reviewing' };
  if (status === 'resolved') return { color: '#2E7D32', background: '#E8F5E9', label: 'Resolved' };
  return { color: '#616161', background: '#F5F5F5', label: 'Dismissed' };
}

export default function AdminChatReportsPage() {
  const [items, setItems] = useState<ChatReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'reviewing' | 'resolved' | 'dismissed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChatReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadList = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Please sign in as super admin.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const reports = await listChatReports(token, {
        status: statusFilter,
        limit: 50,
      });
      setItems(reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chat reports');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = useCallback(async (id: string) => {
    const token = getStoredToken();
    if (!token) return;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setAdminNote('');
    try {
      const report = await getChatReportDetail(token, id);
      setDetail(report);
      setAdminNote(report.adminNote || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load evidence pack');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const onUpdateStatus = useCallback(
    async (status: 'reviewing' | 'resolved' | 'dismissed') => {
      if (!selectedId) return;
      const token = getStoredToken();
      if (!token) return;
      setActionBusy(true);
      try {
        const updated = await updateChatReportStatus(token, selectedId, {
          status,
          adminNote: adminNote.trim() || undefined,
        });
        setDetail(updated);
        await loadList();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update report');
      } finally {
        setActionBusy(false);
      }
    },
    [adminNote, loadList, selectedId]
  );

  const helpfulCount = useMemo(
    () => items.filter((item) => item.feedback === 'helpful').length,
    [items]
  );
  const falseAlarmCount = useMemo(
    () => items.filter((item) => item.feedback === 'false_alarm').length,
    [items]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}>
            Chat evidence packs
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Jobseeker reports with tactics, timeline, and feedback.
          </p>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            Helpful {helpfulCount}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            False alarm {falseAlarmCount}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'new', 'reviewing', 'resolved', 'dismissed'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
              statusFilter === key ? 'text-white' : 'bg-slate-100 text-slate-600'
            }`}
            style={statusFilter === key ? { backgroundColor: colors.navy } : undefined}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void loadList()}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading reports…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No chat reports yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const badge = statusStyle(item.status);
                const active = selectedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void openDetail(item.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        active ? 'bg-[#F5F7FF]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {item.peerLabel || 'Recruiter'} → {item.reporterName || 'Jobseeker'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {REASON_LABELS[item.reasonCode] || item.reasonCode}
                            {item.jobLabel ? ` · ${item.jobLabel}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.flaggedCount} flagged · {item.riskLevel} · {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ color: badge.color, background: badge.background }}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {!selectedId ? (
            <p className="text-sm text-slate-500">Select a report to view the evidence pack.</p>
          ) : detailLoading ? (
            <p className="text-sm text-slate-500">Loading evidence…</p>
          ) : !detail ? (
            <p className="text-sm text-slate-500">Could not load this report.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: colors.navy }}>
                  Evidence pack
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {detail.reporterEmail} · feedback: {detail.feedback}
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <strong>{detail.flaggedCount}</strong> flagged messages
                {detail.tacticsSummary.length
                  ? ` · ${detail.tacticsSummary.join(', ')}`
                  : ''}
                {detail.maxScore != null
                  ? ` · max score ${(detail.maxScore * 100).toFixed(0)}%`
                  : ''}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Timeline
                </h3>
                <ul className="space-y-2">
                  {(detail.timeline || []).map((point, index) => (
                    <li key={`${point.messageId}-${index}`} className="flex gap-2 text-sm">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          point.riskLevel === 'high' ? 'bg-red-500' : 'bg-amber-500'
                        }`}
                      />
                      <div>
                        <p className="font-semibold text-slate-800">{point.label}</p>
                        <p className="text-xs text-slate-500">{formatDate(point.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Flagged messages
                </h3>
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {(detail.evidenceMessages || [])
                    .filter((m) => m.scamAnalysis?.status === 'flagged' || m.scamAnalysis?.isScam)
                    .map((message) => (
                      <li
                        key={message.messageId}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <p className="text-slate-800">{message.body || `(${message.messageType})`}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {message.scamAnalysis.tactics.join(', ') || 'no tactics'}
                          {message.scamAnalysis.score != null
                            ? ` · ${(message.scamAnalysis.score * 100).toFixed(0)}%`
                            : ''}
                        </p>
                      </li>
                    ))}
                </ul>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Admin note</label>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  className="min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Internal note…"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void onUpdateStatus('reviewing')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
                >
                  Mark reviewing
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void onUpdateStatus('resolved')}
                  className="rounded-lg px-3 py-2 text-xs font-bold text-white"
                  style={{ backgroundColor: colors.navy }}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void onUpdateStatus('dismissed')}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
