'use client';

import { useMemo, useState, type ReactNode } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { MOCK_MANAGED_USERS } from '@/lib/admin/mockUsers';
import type {
  ManagedAccountStatus,
  ManagedAccountType,
  ManagedUser,
} from '@/lib/admin/types';
import { colors } from '@/lib/theme/colors';

type TypeFilter = 'all' | ManagedAccountType;
type StatusFilter = 'all' | ManagedAccountStatus;

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'jobseeker', label: 'Jobseekers' },
  { value: 'recruiter', label: 'Recruiters' },
  { value: 'company', label: 'Companies' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
];

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>(MOCK_MANAGED_USERS);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [message, setMessage] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      total: users.length,
      jobseeker: users.filter((u) => u.accountType === 'jobseeker').length,
      recruiter: users.filter((u) => u.accountType === 'recruiter').length,
      company: users.filter((u) => u.accountType === 'company').length,
      active: users.filter((u) => u.accountStatus === 'active').length,
      suspended: users.filter((u) => u.accountStatus === 'suspended').length,
      banned: users.filter((u) => u.accountStatus === 'banned').length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (typeFilter !== 'all' && user.accountType !== typeFilter) return false;
      if (statusFilter !== 'all' && user.accountStatus !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        user.fullName,
        user.email,
        user.organization ?? '',
        user.location ?? '',
        user.id,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query, typeFilter, statusFilter]);

  const setStatus = (userId: string, next: ManagedAccountStatus) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, accountStatus: next } : user
      )
    );

    const action =
      next === 'active'
        ? 'restored'
        : next === 'suspended'
          ? 'suspended'
          : 'banned';
    setMessage(`${target.fullName} was ${action}.`);
  };

  return (
    <AdminShell title="User Management">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={counts.total} />
          <StatCard label="Jobseekers" value={counts.jobseeker} />
          <StatCard label="Recruiters" value={counts.recruiter} />
          <StatCard label="Companies" value={counts.company} />
        </div>

        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Platform users
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Search and manage jobseekers, recruiters, and companies. Actions use
                mock data for now.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Pill label={`${counts.active} active`} tone="active" />
              <Pill label={`${counts.suspended} suspended`} tone="suspended" />
              <Pill label={`${counts.banned} banned`} tone="banned" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <label className="block">
              <span className="sr-only">Search users</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email, organization…"
                className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none transition focus:border-[#202871]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              />
            </label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {STATUS_OPTIONS.map((option) => (
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

        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p
              className="px-6 py-12 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              No users match your search or filters.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#EEF0F8] bg-[#F7F8FE]">
                    <tr>
                      <Th>User</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Joined</Th>
                      <Th>Last login</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF0F8]">
                    {filtered.map((user) => (
                      <tr key={user.id} className="align-top">
                        <td className="px-5 py-4">
                          <UserCell user={user} />
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="text-sm font-medium"
                            style={{
                              color: colors.navy,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {typeLabel(user.accountType)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={user.accountStatus} />
                        </td>
                        <td
                          className="px-5 py-4 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {formatDate(user.createdAt)}
                        </td>
                        <td
                          className="px-5 py-4 text-sm"
                          style={{
                            color: colors.body,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {formatDate(user.lastLoginAt)}
                        </td>
                        <td className="px-5 py-4">
                          <ActionButtons
                            user={user}
                            onSuspend={() => setStatus(user.id, 'suspended')}
                            onBan={() => setStatus(user.id, 'banned')}
                            onRestore={() => setStatus(user.id, 'active')}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[#EEF0F8] md:hidden">
                {filtered.map((user) => (
                  <li key={user.id} className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <UserCell user={user} />
                      <StatusBadge status={user.accountStatus} />
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                    >
                      {typeLabel(user.accountType)} · Joined {formatDate(user.createdAt)}
                    </p>
                    <ActionButtons
                      user={user}
                      onSuspend={() => setStatus(user.id, 'suspended')}
                      onBan={() => setStatus(user.id, 'banned')}
                      onRestore={() => setStatus(user.id, 'active')}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <p
          className="text-center text-xs"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          Showing {filtered.length} of {users.length} users (mock data)
        </p>
      </div>
    </AdminShell>
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

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: ManagedAccountStatus;
}) {
  const styles = statusStyles(tone);
  return (
    <span
      className="rounded-full px-3 py-1"
      style={{
        backgroundColor: styles.background,
        color: styles.color,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {label}
    </span>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      className="px-5 py-3 text-xs font-semibold uppercase tracking-wide"
      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
    >
      {children}
    </th>
  );
}

function UserCell({ user }: { user: ManagedUser }) {
  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
        <span
          className="text-xs font-bold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {initials || 'U'}
        </span>
      </div>
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
        {user.organization ? (
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            {user.organization}
            {user.location ? ` · ${user.location}` : ''}
          </p>
        ) : user.location ? (
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            {user.location}
          </p>
        ) : null}
        {!user.emailVerified ? (
          <p
            className="mt-1 text-[11px] font-medium text-[#EF6C00]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            Email not verified
          </p>
        ) : null}
      </div>
    </div>
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

function ActionButtons({
  user,
  onSuspend,
  onBan,
  onRestore,
}: {
  user: ManagedUser;
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
          <ActionButton label="Suspend" onClick={onSuspend} tone="warn" />
          <ActionButton label="Ban" onClick={onBan} tone="danger" />
        </>
      ) : null}
      {isSuspended ? (
        <>
          <ActionButton label="Restore" onClick={onRestore} tone="success" />
          <ActionButton label="Ban" onClick={onBan} tone="danger" />
        </>
      ) : null}
      {isBanned ? (
        <ActionButton label="Restore" onClick={onRestore} tone="success" />
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: 'warn' | 'danger' | 'success';
}) {
  const styles =
    tone === 'warn'
      ? { color: '#EF6C00', border: '#FFE0B2' }
      : tone === 'danger'
        ? { color: '#C62828', border: '#FFCDD2' }
        : { color: '#2E7D32', border: '#C8E6C9' };

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border px-3 py-2 text-xs font-semibold transition hover:bg-[#F7F8FE]"
      style={{
        color: styles.color,
        borderColor: styles.border,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {label}
    </button>
  );
}
