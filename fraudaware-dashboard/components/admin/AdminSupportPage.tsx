'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type {
  SupportLinkedType,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@/lib/admin/supportTypes';
import {
  addSupportTicketMessage,
  assignSupportTicketToMe,
  listSupportTickets,
  updateSupportTicket,
  type SupportTicketCounts,
} from '@/lib/api/adminSupportApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type StatusFilter = 'all' | SupportTicketStatus;

const EMPTY_COUNTS: SupportTicketCounts = {
  total: 0,
  open: 0,
  in_progress: 0,
  closed: 0,
};

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
};

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function ticketLabel(ticket: SupportTicket): string {
  return ticket.ticketNumber || ticket.id;
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

function statusStyles(status: SupportTicketStatus): {
  color: string;
  background: string;
} {
  if (status === 'open') return { color: '#EF6C00', background: '#FFF3E0' };
  if (status === 'in_progress')
    return { color: '#1565C0', background: '#E3F2FD' };
  return { color: '#2E7D32', background: '#E8F5E9' };
}

function priorityStyles(priority: SupportTicketPriority): {
  color: string;
  background: string;
} {
  if (priority === 'high') return { color: '#C62828', background: '#FFEBEE' };
  if (priority === 'medium') return { color: '#EF6C00', background: '#FFF3E0' };
  return { color: '#616161', background: '#F5F5F5' };
}

function linkedHref(type: SupportLinkedType): string | null {
  if (type === 'user') return '/admin/users';
  if (type === 'job') return '/admin/jobs';
  if (type === 'report') return '/admin/reports';
  return null;
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState<SupportTicketCounts>(EMPTY_COUNTS);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  const loadTickets = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in as a super admin to manage support tickets.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listSupportTickets(token, {
        status: filter,
        q: query,
        limit: 100,
      });
      setTickets(result.items);
      setCounts(result.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load support tickets');
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const applyTicketUpdate = useCallback((updated: SupportTicket) => {
    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === updated.id ? updated : ticket))
    );
  }, []);

  const runAction = useCallback(
    async (action: () => Promise<SupportTicket>, successMessage: string) => {
      const token = getStoredToken();
      if (!token) {
        setError('Sign in as a super admin to manage support tickets.');
        return;
      }

      setActionBusy(true);
      setError(null);
      try {
        const updated = await action();
        applyTicketUpdate(updated);
        setMessage(successMessage);
        void loadTickets();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setActionBusy(false);
      }
    },
    [applyTicketUpdate, loadTickets]
  );

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
      setReplyDraft('');
      setInternalNote('');
      return;
    }
    setInternalNote(selected.internalNote ?? '');
    setReplyDraft('');
  }, [selected]);

  const openTicket = (id: string) => {
    setSelectedId(id);
    setMessage(null);
    setError(null);
  };

  const assignToMe = (id: string) => {
    const token = getStoredToken();
    if (!token) return;
    void runAction(
      () => assignSupportTicketToMe(token, id),
      'Ticket assigned to you.'
    );
  };

  const setPriority = (id: string, priority: SupportTicketPriority) => {
    const token = getStoredToken();
    if (!token) return;
    void runAction(
      () => updateSupportTicket(token, id, { priority }),
      `Priority set to ${PRIORITY_LABELS[priority]}.`
    );
  };

  const saveInternalNote = (id: string) => {
    const token = getStoredToken();
    if (!token) return;
    void runAction(
      () =>
        updateSupportTicket(token, id, {
          internalNote: internalNote.trim() || null,
        }),
      'Internal note saved.'
    );
  };

  const sendReply = (id: string) => {
    const body = replyDraft.trim();
    if (!body) {
      setError('Write a reply before sending.');
      return;
    }
    const token = getStoredToken();
    if (!token) return;
    void runAction(async () => {
      const updated = await addSupportTicketMessage(token, id, body);
      setReplyDraft('');
      return updated;
    }, 'Reply sent.');
  };

  const closeTicket = (id: string) => {
    const token = getStoredToken();
    if (!token) return;
    void runAction(async () => {
      const updated = await updateSupportTicket(token, id, { status: 'closed' });
      setSelectedId(null);
      return updated;
    }, 'Ticket closed.');
  };

  const reopenTicket = (id: string) => {
    const token = getStoredToken();
    if (!token) return;
    void runAction(
      () => updateSupportTicket(token, id, { status: 'open' }),
      'Ticket reopened.'
    );
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
            label="Open"
            count={counts.open}
            active={filter === 'open'}
            onClick={() => setFilter('open')}
            tone="open"
          />
          <FilterChip
            label="In progress"
            count={counts.in_progress}
            active={filter === 'in_progress'}
            onClick={() => setFilter('in_progress')}
            tone="in_progress"
          />
          <FilterChip
            label="Closed"
            count={counts.closed}
            active={filter === 'closed'}
            onClick={() => setFilter('closed')}
            tone="closed"
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
                <span className="sr-only">Search tickets</span>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search subject, requester, assignee…"
                  className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
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
              {loading ? 'Loading…' : `${tickets.length} shown`}
            </p>
          </div>

          {error && !selected ? (
            <div
              className="border-b border-[#FFCDD2] bg-[#FFEBEE] px-4 py-2.5 text-sm text-[#C62828] sm:px-5"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </div>
          ) : null}

          {message ? (
            <div
              className="border-b border-[#C8E6C9] bg-[#E8F5E9] px-4 py-2.5 text-sm text-[#2E7D32] sm:px-5"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
            </div>
          ) : null}

          {loading ? (
            <p
              className="px-5 py-16 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Loading support tickets…
            </p>
          ) : tickets.length === 0 ? (
            <p
              className="px-5 py-16 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              No tickets match this filter.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#EEF0F8] bg-[#F7F8FE]">
                    <tr>
                      <Th>Subject</Th>
                      <Th>Requester</Th>
                      <Th>Priority</Th>
                      <Th>Status</Th>
                      <Th>Assignee</Th>
                      <Th>Updated</Th>
                      <Th className="text-right"> </Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF0F8]">
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="cursor-pointer transition hover:bg-[#FAFBFF]"
                        onClick={() => openTicket(ticket.id)}
                      >
                        <td className="px-5 py-3.5">
                          <p
                            className="max-w-[260px] truncate font-semibold"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {ticket.subject}
                          </p>
                          <p
                            className="mt-0.5 text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {ticketLabel(ticket)}
                            {ticket.linkedLabel
                              ? ` · ${ticket.linkedLabel}`
                              : ''}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p
                            className="truncate"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {ticket.requesterName}
                          </p>
                          <p
                            className="truncate text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {ticket.requesterEmail}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <PriorityBadge priority={ticket.priority} />
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td
                          className="px-5 py-3.5 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {ticket.assigneeName ?? 'Unassigned'}
                        </td>
                        <td
                          className="whitespace-nowrap px-5 py-3.5 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {formatRelative(ticket.updatedAt)}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openTicket(ticket.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#202871] hover:bg-[#F2F6FF]"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                          >
                            Open →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[#EEF0F8] md:hidden">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#FAFBFF]"
                      onClick={() => openTicket(ticket.id)}
                    >
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{
                            color: colors.navy,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {ticket.subject}
                        </p>
                        <p
                          className="mt-0.5 text-xs"
                          style={{
                            color: colors.muted,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {ticket.requesterName} ·{' '}
                          {formatRelative(ticket.updatedAt)}
                        </p>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {selected ? (
        <SupportDrawer
          ticket={selected}
          replyDraft={replyDraft}
          internalNote={internalNote}
          error={error}
          busy={actionBusy}
          onReplyDraftChange={(value) => {
            setReplyDraft(value);
            setError(null);
          }}
          onInternalNoteChange={setInternalNote}
          onClose={() => setSelectedId(null)}
          onAssign={() => assignToMe(selected.id)}
          onPriority={(priority) => setPriority(selected.id, priority)}
          onSaveNote={() => saveInternalNote(selected.id)}
          onSendReply={() => sendReply(selected.id)}
          onCloseTicket={() => closeTicket(selected.id)}
          onReopen={() => reopenTicket(selected.id)}
        />
      ) : null}
    </>
  );
}

function SupportDrawer({
  ticket,
  replyDraft,
  internalNote,
  error,
  busy,
  onReplyDraftChange,
  onInternalNoteChange,
  onClose,
  onAssign,
  onPriority,
  onSaveNote,
  onSendReply,
  onCloseTicket,
  onReopen,
}: {
  ticket: SupportTicket;
  replyDraft: string;
  internalNote: string;
  error: string | null;
  busy: boolean;
  onReplyDraftChange: (value: string) => void;
  onInternalNoteChange: (value: string) => void;
  onClose: () => void;
  onAssign: () => void;
  onPriority: (priority: SupportTicketPriority) => void;
  onSaveNote: () => void;
  onSendReply: () => void;
  onCloseTicket: () => void;
  onReopen: () => void;
}) {
  const related = linkedHref(ticket.linkedType);
  const open = ticket.status !== 'closed';

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
        aria-labelledby="support-drawer-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF0F8] px-5 py-4">
          <div className="min-w-0">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Ticket · {ticketLabel(ticket)}
            </p>
            <h2
              id="support-drawer-title"
              className="mt-1 text-lg font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {ticket.subject}
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
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>

          <dl className="grid gap-2 sm:grid-cols-2">
            <DetailRow label="Requester" value={ticket.requesterName} />
            <DetailRow label="Email" value={ticket.requesterEmail} />
            <DetailRow
              label="Assignee"
              value={ticket.assigneeName ?? 'Unassigned'}
            />
            <DetailRow label="Updated" value={formatDate(ticket.updatedAt)} />
            <DetailRow label="Created" value={formatDate(ticket.createdAt)} />
            <DetailRow
              label="Linked"
              value={ticket.linkedLabel ?? 'None'}
            />
          </dl>

          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Description
            </h3>
            <p
              className="mt-2 rounded-xl bg-[#F7F8FE] px-4 py-3 text-sm leading-relaxed"
              style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
            >
              {ticket.description}
            </p>
          </section>

          {related && ticket.linkedLabel ? (
            <Link
              href={related}
              className="inline-flex rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm font-semibold text-[#202871] hover:bg-[#F7F8FE]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Open related {ticket.linkedType} →
            </Link>
          ) : null}

          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Conversation
            </h3>
            <ul className="mt-2 space-y-2">
              {ticket.messages.map((msg) => (
                <li
                  key={msg.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    msg.author === 'admin'
                      ? 'border-[#C8E6C9] bg-[#F1F8F2]'
                      : 'border-[#EEF0F8] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-xs font-semibold"
                      style={{
                        color: colors.navy,
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      {msg.authorName}
                      {msg.author === 'admin' ? ' · Admin' : ''}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{
                        color: colors.muted,
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      {formatRelative(msg.createdAt)}
                    </p>
                  </div>
                  <p
                    className="mt-1 text-sm leading-relaxed"
                    style={{
                      color: colors.body,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    {msg.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {open ? (
            <>
              <label className="block">
                <span
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                  style={{
                    color: colors.muted,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  Reply to requester
                </span>
                <textarea
                  value={replyDraft}
                  onChange={(event) => onReplyDraftChange(event.target.value)}
                  rows={3}
                  placeholder="Write a helpful reply…"
                  className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
                  style={{
                    color: colors.navy,
                    fontFamily: 'var(--font-poppins)',
                  }}
                />
              </label>
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
                  Internal note (admin only)
                </span>
                <textarea
                  value={internalNote}
                  onChange={(event) => onInternalNoteChange(event.target.value)}
                  rows={2}
                  placeholder="Private notes for other admins…"
                  className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
                  style={{
                    color: colors.navy,
                    fontFamily: 'var(--font-poppins)',
                  }}
                />
              </label>
            </>
          ) : ticket.internalNote ? (
            <div className="rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-4 py-3">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                Internal note
              </p>
              <p
                className="mt-1 text-sm"
                style={{
                  color: colors.navy,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                {ticket.internalNote}
              </p>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-3 border-t border-[#EEF0F8] px-5 py-4">
          {open ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onAssign}
                  disabled={busy}
                  className="rounded-xl border border-[#BBDEFB] bg-[#E3F2FD] px-3 py-2 text-xs font-semibold text-[#1565C0] disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Assign to me
                </button>
                {(['low', 'medium', 'high'] as SupportTicketPriority[]).map(
                  (priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => onPriority(priority)}
                      disabled={busy}
                      className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                      style={{
                        color: colors.navy,
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      {PRIORITY_LABELS[priority]}
                    </button>
                  )
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSendReply}
                  disabled={busy}
                  className="rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Send reply
                </button>
                <button
                  type="button"
                  onClick={onSaveNote}
                  disabled={busy}
                  className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                  style={{
                    color: colors.navy,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={onCloseTicket}
                  disabled={busy}
                  className="rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-2.5 text-sm font-semibold text-[#2E7D32] disabled:opacity-60"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Close ticket
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onReopen}
              disabled={busy}
              className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Reopen ticket
            </button>
          )}
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
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: SupportTicketStatus;
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

function StatusBadge({ status }: { status: SupportTicketStatus }) {
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
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  const styles = priorityStyles(priority);
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        color: styles.color,
        backgroundColor: styles.background,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {PRIORITY_LABELS[priority]}
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
