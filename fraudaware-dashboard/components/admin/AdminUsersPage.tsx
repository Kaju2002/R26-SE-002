'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  ManagedAccountStatus,
  ManagedAccountType,
  ManagedUser,
} from '@/lib/admin/types';
import {
  listManagedUsers,
  updateManagedUserStatus,
  type ManagedUserCounts,
} from '@/lib/api/adminUsersApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type TypeFilter = 'all' | ManagedAccountType;
type StatusFilter = 'all' | ManagedAccountStatus;

const PAGE_SIZE = 10;

const EMPTY_COUNTS: ManagedUserCounts = {
  total: 0,
  jobseeker: 0,
  recruiter: 0,
  company: 0,
  active: 0,
  suspended: 0,
  banned: 0,
};

const EMPTY_PAGINATION = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusStyles(status: ManagedAccountStatus): {
  background: string;
  color: string;
} {
  if (status === 'active') return { background: '#E8F5E9', color: '#2E7D32' };
  if (status === 'suspended') return { background: '#FFF3E0', color: '#EF6C00' };
  return { background: '#FFEBEE', color: '#C62828' };
}

function typeLabel(type: ManagedAccountType): string {
  if (type === 'jobseeker') return 'Jobseeker';
  if (type === 'recruiter') return 'Recruiter';
  return 'Company';
}

function initialsFromName(fullName: string): string {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [counts, setCounts] = useState<ManagedUserCounts>(EMPTY_COUNTS);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalUserId, setModalUserId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in as a super admin to manage users.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listManagedUsers(token, {
        q: query,
        accountType: typeFilter,
        accountStatus: statusFilter,
        page,
        limit: PAGE_SIZE,
      });
      setUsers(result.items);
      setCounts(result.counts);
      setPagination(result.pagination);
      if (
        result.pagination.totalPages >= 1 &&
        page > result.pagination.totalPages
      ) {
        setPage(result.pagination.totalPages);
      }
      setModalUserId((prev) => {
        if (prev && result.items.some((item) => item.id === prev)) return prev;
        return null;
      });
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load users.'
      );
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, statusFilter, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!modalUserId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalUserId(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalUserId]);

  const modalUser = modalUserId
    ? (users.find((user) => user.id === modalUserId) ?? null)
    : null;

  const applyTypeFilter = (next: TypeFilter) => {
    setPage(1);
    setTypeFilter(next);
  };

  const applyStatusFilter = (next: StatusFilter) => {
    setPage(1);
    setStatusFilter(next);
  };

  const changeStatus = async (userId: string, next: ManagedAccountStatus) => {
    const token = getStoredToken();
    const target = users.find((user) => user.id === userId);
    if (!token || !target) return;

    setBusyId(userId);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateManagedUserStatus(token, userId, next);
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? updated : user))
      );
      const action =
        next === 'active'
          ? 'restored'
          : next === 'suspended'
            ? 'suspended'
            : 'banned';
      setMessage(`${target.fullName} was ${action}.`);
      void listManagedUsers(token, {
        q: query,
        accountType: typeFilter,
        accountStatus: statusFilter,
        page,
        limit: PAGE_SIZE,
      }).then((result) => {
        setCounts(result.counts);
        setUsers(result.items);
        setPagination(result.pagination);
        if (
          result.pagination.totalPages >= 1 &&
          page > result.pagination.totalPages
        ) {
          setPage(result.pagination.totalPages);
        }
      });
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update user status.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Compact overview — also acts as filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            count={counts.total}
            active={typeFilter === 'all'}
            onClick={() => applyTypeFilter('all')}
          />
          <FilterChip
            label="Jobseekers"
            count={counts.jobseeker}
            active={typeFilter === 'jobseeker'}
            onClick={() => applyTypeFilter('jobseeker')}
          />
          <FilterChip
            label="Recruiters"
            count={counts.recruiter}
            active={typeFilter === 'recruiter'}
            onClick={() => applyTypeFilter('recruiter')}
          />
          <FilterChip
            label="Companies"
            count={counts.company}
            active={typeFilter === 'company'}
            onClick={() => applyTypeFilter('company')}
          />
          <span
            className="mx-1 hidden h-5 w-px bg-[#E5E7EE] sm:block"
            aria-hidden
          />
          <StatusChip
            label="Active"
            count={counts.active}
            tone="active"
            active={statusFilter === 'active'}
            onClick={() =>
              applyStatusFilter(statusFilter === 'active' ? 'all' : 'active')
            }
          />
          <StatusChip
            label="Suspended"
            count={counts.suspended}
            tone="suspended"
            active={statusFilter === 'suspended'}
            onClick={() =>
              applyStatusFilter(
                statusFilter === 'suspended' ? 'all' : 'suspended'
              )
            }
          />
          <StatusChip
            label="Banned"
            count={counts.banned}
            tone="banned"
            active={statusFilter === 'banned'}
            onClick={() =>
              applyStatusFilter(statusFilter === 'banned' ? 'all' : 'banned')
            }
          />
        </div>

        {/* One panel: search + list + pager — list stays above the fold */}
        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#EEF0F8] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setQuery(queryInput.trim());
              }}
            >
              <label className="block min-w-0 flex-1">
                <span className="sr-only">Search users</span>
                <input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search name, email, organization…"
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
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="shrink-0 rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
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

          {loading && users.length === 0 ? (
            <p
              className="px-5 py-16 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Loading users…
            </p>
          ) : users.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p
                className="text-sm font-semibold"
                style={{
                  color: colors.navy,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                No users found
              </p>
              <p
                className="mt-1 text-sm"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                Try another search or clear the type / status filters.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#EEF0F8] bg-[#F7F8FE]">
                    <tr>
                      <Th>User</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Joined</Th>
                      <Th className="text-right"> </Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF0F8]">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="cursor-pointer transition hover:bg-[#FAFBFF]"
                        onClick={() => setModalUserId(user.id)}
                      >
                        <td className="px-5 py-3">
                          <UserCell user={user} />
                        </td>
                        <td className="px-5 py-3">
                          <TypeBadge type={user.accountType} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={user.accountStatus} />
                        </td>
                        <td
                          className="whitespace-nowrap px-5 py-3 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {formatDate(user.createdAt)}
                        </td>
                        <td
                          className="px-5 py-3 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setModalUserId(user.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#202871] hover:bg-[#F2F6FF]"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                          >
                            Manage →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[#EEF0F8] md:hidden">
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#FAFBFF]"
                      onClick={() => setModalUserId(user.id)}
                    >
                      <UserCell user={user} />
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusBadge status={user.accountStatus} />
                        <span
                          className="text-[11px] font-semibold"
                          style={{
                            color: colors.muted,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {typeLabel(user.accountType)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="border-t border-[#EEF0F8] px-4 py-3 sm:px-5">
            <PaginationBar
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              loading={loading}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      {modalUser ? (
        <UserDetailModal
          user={modalUser}
          busy={busyId === modalUser.id}
          onClose={() => setModalUserId(null)}
          onSuspend={() => void changeStatus(modalUser.id, 'suspended')}
          onBan={() => void changeStatus(modalUser.id, 'banned')}
          onRestore={() => void changeStatus(modalUser.id, 'active')}
        />
      ) : null}
    </>
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

function StatusChip({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: ManagedAccountStatus;
  active: boolean;
  onClick: () => void;
}) {
  const styles = statusStyles(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'ring-2 ring-[#202871]/25 ring-offset-1' : ''
      }`}
      style={{
        backgroundColor: styles.background,
        color: styles.color,
        borderColor: active ? styles.color : 'transparent',
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {label}
      <span className="font-bold">{count}</span>
    </button>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  return (
    <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
      <p
        className="text-xs"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {total === 0
          ? 'No users to show'
          : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Previous
        </button>
        <span
          className="min-w-[4.5rem] text-center text-xs font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function UserDetailModal({
  user,
  busy,
  onClose,
  onSuspend,
  onBan,
  onRestore,
}: {
  user: ManagedUser;
  busy: boolean;
  onClose: () => void;
  onSuspend: () => void;
  onBan: () => void;
  onRestore: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-user-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <h3
                id="admin-user-modal-title"
                className="truncate text-lg font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {user.fullName}
              </h3>
              <p
                className="mt-0.5 truncate text-sm"
                style={{
                  color: colors.muted,
                  fontFamily: 'var(--font-poppins)',
                }}
              >
                {user.email}
              </p>
            </div>
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

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={user.accountStatus} />
          <TypeBadge type={user.accountType} />
        </div>

        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <DetailRow label="Organization" value={user.organization} />
          <DetailRow label="Location" value={user.location} />
          <DetailRow
            label="Email verified"
            value={user.emailVerified ? 'Yes' : 'No'}
          />
          <DetailRow label="Joined" value={formatDate(user.createdAt)} />
          <DetailRow label="Last login" value={formatDate(user.lastLoginAt)} />
          <DetailRow label="User ID" value={user.id} mono />
        </dl>

        <div className="mt-5 border-t border-[#EEF0F8] pt-4">
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Account actions
          </p>
          <StatusActionButtons
            user={user}
            busy={busy}
            onSuspend={onSuspend}
            onBan={onBan}
            onRestore={onRestore}
          />
        </div>
      </div>
    </div>
  );
}

function UserAvatar({
  user,
  size = 'md',
}: {
  user: ManagedUser;
  size?: 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === 'lg' ? 'h-14 w-14 text-sm' : 'h-9 w-9 text-[11px]';
  const url = user.avatarUrl?.trim() || '';

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={url}
        src={url}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover`}
        style={{ backgroundColor: '#EEF0F8' }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]`}
    >
      <span
        className="font-bold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {initialsFromName(user.fullName)}
      </span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
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

function UserCell({ user }: { user: ManagedUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar user={user} />
      <div className="min-w-0">
        <p
          className="truncate text-sm font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {user.fullName}
        </p>
        <p
          className="truncate text-xs"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {user.email}
        </p>
        {user.organization || !user.emailVerified ? (
          <p
            className="mt-0.5 truncate text-[11px]"
            style={{
              color: user.emailVerified ? colors.body : '#EF6C00',
              fontFamily: 'var(--font-poppins)',
            }}
          >
            {[
              user.organization,
              !user.emailVerified ? 'Email not verified' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: ManagedAccountType }) {
  return (
    <span
      className="inline-flex rounded-full bg-[#F2F6FF] px-2.5 py-1 text-xs font-semibold"
      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
    >
      {typeLabel(type)}
    </span>
  );
}

function StatusBadge({ status }: { status: ManagedAccountStatus }) {
  const styles = statusStyles(status);
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
      style={{
        backgroundColor: styles.background,
        color: styles.color,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {status}
    </span>
  );
}

function StatusActionButtons({
  user,
  busy,
  onSuspend,
  onBan,
  onRestore,
}: {
  user: ManagedUser;
  busy?: boolean;
  onSuspend: () => void;
  onBan: () => void;
  onRestore: () => void;
}) {
  const isActive = user.accountStatus === 'active';
  const isSuspended = user.accountStatus === 'suspended';
  const isBanned = user.accountStatus === 'banned';

  return (
    <div className="flex flex-wrap gap-2">
      {isActive ? (
        <>
          <ActionButton
            label="Suspend"
            onClick={onSuspend}
            tone="warn"
            disabled={busy}
          />
          <ActionButton
            label="Ban"
            onClick={onBan}
            tone="danger"
            disabled={busy}
          />
        </>
      ) : null}
      {isSuspended ? (
        <>
          <ActionButton
            label="Restore"
            onClick={onRestore}
            tone="success"
            disabled={busy}
          />
          <ActionButton
            label="Ban"
            onClick={onBan}
            tone="danger"
            disabled={busy}
          />
        </>
      ) : null}
      {isBanned ? (
        <ActionButton
          label="Restore"
          onClick={onRestore}
          tone="success"
          disabled={busy}
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  tone,
  disabled,
}: {
  label: string;
  onClick: () => void;
  tone: 'warn' | 'danger' | 'success' | 'neutral';
  disabled?: boolean;
}) {
  const styles =
    tone === 'warn'
      ? { color: '#EF6C00', border: '#FFE0B2', bg: '#FFF8F0' }
      : tone === 'danger'
        ? { color: '#C62828', border: '#FFCDD2', bg: '#FFF5F5' }
        : tone === 'success'
          ? { color: '#2E7D32', border: '#C8E6C9', bg: '#F1F8F2' }
          : { color: colors.navy, border: '#E5E7EE', bg: '#F7F8FE' };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
      style={{
        color: styles.color,
        borderColor: styles.border,
        backgroundColor: styles.bg,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {disabled ? 'Saving…' : label}
    </button>
  );
}
