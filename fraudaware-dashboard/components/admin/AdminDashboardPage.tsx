'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listManagedUsers,
  type ManagedUserCounts,
} from '@/lib/api/adminUsersApi';
import {
  listVerificationRequests,
  type VerificationCounts,
} from '@/lib/api/adminVerificationApi';
import {
  listModerationJobs,
  type ModeratedJobRecord,
  type ModerationCounts,
} from '@/lib/api/jobApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';
import type { CompanyVerificationRequest } from '@/lib/admin/verificationTypes';

type AttentionItem = {
  id: string;
  kind: 'verification' | 'job' | 'user';
  title: string;
  subtitle: string;
  tone: 'warn' | 'danger' | 'info';
  href: string;
  when?: string | null;
};

const EMPTY_USER_COUNTS: ManagedUserCounts = {
  total: 0,
  jobseeker: 0,
  recruiter: 0,
  company: 0,
  active: 0,
  suspended: 0,
  banned: 0,
};

const EMPTY_JOB_COUNTS: ModerationCounts = {
  total: 0,
  flagged: 0,
  cleared: 0,
  forceClosed: 0,
};

function formatRelative(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function last7DayLabels(): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      key: dayKey(d),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }
  return days;
}

export default function AdminDashboardPage() {
  const [userCounts, setUserCounts] =
    useState<ManagedUserCounts>(EMPTY_USER_COUNTS);
  const [jobCounts, setJobCounts] =
    useState<ModerationCounts>(EMPTY_JOB_COUNTS);
  const [flaggedJobs, setFlaggedJobs] = useState<ModeratedJobRecord[]>([]);
  const [userJoinSeries, setUserJoinSeries] = useState<number[]>(
    () => Array(7).fill(0)
  );
  const [jobFlagSeries, setJobFlagSeries] = useState<number[]>(
    () => Array(7).fill(0)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationCounts, setVerificationCounts] = useState<VerificationCounts>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [pendingVerifications, setPendingVerifications] = useState<
    CompanyVerificationRequest[]
  >([]);

  const reload = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in as a super admin to view live platform metrics.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const days = last7DayLabels();
    const joinBuckets = Object.fromEntries(days.map((d) => [d.key, 0])) as Record<
      string,
      number
    >;
    const flagBuckets = { ...joinBuckets };

    try {
      const [usersResult, jobsResult, flaggedResult, verificationResult] =
        await Promise.all([
          listManagedUsers(token, { limit: 100 }),
          listModerationJobs(token, { moderationStatus: 'all', limit: 50 }),
          listModerationJobs(token, { moderationStatus: 'flagged', limit: 10 }),
          listVerificationRequests(token, { decision: 'all', limit: 100 }),
        ]);

      setUserCounts(usersResult.counts);
      setVerificationCounts(verificationResult.counts);
      setPendingVerifications(
        verificationResult.items
          .filter((item) => item.decision === 'pending')
          .slice(0, 4)
      );
      setJobCounts(jobsResult.counts);
      setFlaggedJobs(flaggedResult.jobs);

      for (const user of usersResult.items) {
        const key = dayKey(new Date(user.createdAt));
        if (key in joinBuckets) joinBuckets[key] += 1;
      }
      for (const job of jobsResult.jobs) {
        const stamp = job.flaggedAt || job.postedAt;
        if (!stamp) continue;
        const key = dayKey(new Date(stamp));
        if (key in flagBuckets) flagBuckets[key] += 1;
      }

      setUserJoinSeries(days.map((d) => joinBuckets[d.key] ?? 0));
      setJobFlagSeries(days.map((d) => flagBuckets[d.key] ?? 0));
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load dashboard metrics.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attention = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];

    for (const request of pendingVerifications) {
      items.push({
        id: `ver-${request.id}`,
        kind: 'verification',
        title: request.companyName,
        subtitle: `Verification · risk ${Math.round(request.riskScore * 100)}%`,
        tone: request.riskScore >= 0.6 ? 'danger' : 'warn',
        href: '/admin/verification',
        when: request.submittedAt,
      });
    }

    for (const job of flaggedJobs.slice(0, 4)) {
      items.push({
        id: `job-${job.id}`,
        kind: 'job',
        title: job.title,
        subtitle: `${job.companyName} · ${Math.round(job.fakeJobScore * 100)}% fake`,
        tone: job.fakeJobScore >= 0.7 ? 'danger' : 'warn',
        href: '/admin/jobs',
        when: job.flaggedAt || job.postedAt,
      });
    }

    if (userCounts.suspended > 0) {
      items.push({
        id: 'users-suspended',
        kind: 'user',
        title: `${userCounts.suspended} suspended account${userCounts.suspended === 1 ? '' : 's'}`,
        subtitle: 'Review in User Management',
        tone: 'info',
        href: '/admin/users',
      });
    }
    if (userCounts.banned > 0) {
      items.push({
        id: 'users-banned',
        kind: 'user',
        title: `${userCounts.banned} banned account${userCounts.banned === 1 ? '' : 's'}`,
        subtitle: 'Review in User Management',
        tone: 'danger',
        href: '/admin/users',
      });
    }

    return items
      .sort((a, b) => {
        const ta = a.when ? new Date(a.when).getTime() : 0;
        const tb = b.when ? new Date(b.when).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [flaggedJobs, pendingVerifications, userCounts.banned, userCounts.suspended]);

  const dayLabels = last7DayLabels().map((d) => d.label);
  const urgentCount =
    verificationCounts.pending + jobCounts.flagged + userCounts.banned;

  return (
    <>
      <div className="space-y-5">
        {/* Hero strip */}
        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-gradient-to-br from-[#F7F8FE] via-white to-[#EEF2FF] p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Safety command center
              </p>
              <h2
                className="mt-1 text-xl font-semibold md:text-2xl"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Keep FraudAware safe today
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Live platform health across users, company verification, and
                flagged jobs. Jump straight into the queues that need action.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  urgentCount > 0
                    ? 'bg-[#FFF3E0] text-[#EF6C00]'
                    : 'bg-[#E8F5E9] text-[#2E7D32]'
                }`}
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {urgentCount > 0
                  ? `${urgentCount} items need attention`
                  : 'No urgent items'}
              </span>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={loading}
                className="rounded-xl border border-[#E5E7EE] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div
            className="rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {error}
          </div>
        ) : null}

        {/* KPI cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total users"
            value={userCounts.total}
            hint={`${userCounts.active} active`}
            href="/admin/users"
            loading={loading}
          />
          <KpiCard
            label="Pending verification"
            value={verificationCounts.pending}
            hint={`${verificationCounts.total} in queue`}
            href="/admin/verification"
            loading={loading}
            tone={verificationCounts.pending > 0 ? 'warn' : 'neutral'}
          />
          <KpiCard
            label="Flagged jobs"
            value={jobCounts.flagged}
            hint={`${jobCounts.cleared} cleared · ${jobCounts.forceClosed} closed`}
            href="/admin/jobs"
            loading={loading}
            tone={jobCounts.flagged > 0 ? 'danger' : 'neutral'}
          />
          <KpiCard
            label="Restricted accounts"
            value={userCounts.suspended + userCounts.banned}
            hint={`${userCounts.suspended} suspended · ${userCounts.banned} banned`}
            href="/admin/users"
            loading={loading}
            tone={
              userCounts.banned > 0
                ? 'danger'
                : userCounts.suspended > 0
                  ? 'warn'
                  : 'neutral'
            }
          />
        </div>

        {/* Charts + attention */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <ChartCard
                title="User mix"
                subtitle="Jobseekers, recruiters, companies"
              >
                <CompositionDonut
                  centerLabel="users"
                  segments={[
                    {
                      label: 'Jobseekers',
                      value: userCounts.jobseeker,
                      color: '#202871',
                    },
                    {
                      label: 'Recruiters',
                      value: userCounts.recruiter,
                      color: '#838BD2',
                    },
                    {
                      label: 'Companies',
                      value: userCounts.company,
                      color: '#4CAF50',
                    },
                  ]}
                />
              </ChartCard>

              <ChartCard
                title="Job moderation"
                subtitle="Flagged vs cleared vs force-closed"
              >
                <CompositionDonut
                  centerLabel="jobs"
                  segments={[
                    { label: 'Flagged', value: jobCounts.flagged, color: '#EF6C00' },
                    { label: 'Cleared', value: jobCounts.cleared, color: '#2E7D32' },
                    {
                      label: 'Force-closed',
                      value: jobCounts.forceClosed,
                      color: '#C62828',
                    },
                  ]}
                />
              </ChartCard>
            </div>

            <ChartCard
              title="Last 7 days"
              subtitle="New users (from recent list) vs flagged jobs activity"
            >
              <ActivityDualBars
                labels={dayLabels}
                users={userJoinSeries}
                flags={jobFlagSeries}
              />
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{
                    color: colors.navy,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#202871]" />
                  New users
                </span>
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{
                    color: colors.body,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#EF6C00]" />
                  Flagged / reviewed jobs
                </span>
              </div>
            </ChartCard>

            <ChartCard
              title="Account health"
              subtitle="Active vs suspended vs banned"
            >
              <CompositionDonut
                centerLabel="accounts"
                segments={[
                  { label: 'Active', value: userCounts.active, color: '#2E7D32' },
                  {
                    label: 'Suspended',
                    value: userCounts.suspended,
                    color: '#EF6C00',
                  },
                  { label: 'Banned', value: userCounts.banned, color: '#C62828' },
                ]}
              />
            </ChartCard>
          </div>

          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#EEF0F8] px-5 py-4">
                <div>
                  <h3
                    className="text-base font-semibold"
                    style={{
                      color: colors.navy,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    Needs attention
                  </h3>
                  <p
                    className="mt-0.5 text-xs"
                    style={{
                      color: colors.muted,
                      fontFamily: 'var(--font-poppins)',
                    }}
                  >
                    Highest-priority review items
                  </p>
                </div>
              </div>
              {attention.length === 0 ? (
                <p
                  className="px-5 py-10 text-center text-sm"
                  style={{
                    color: colors.muted,
                    fontFamily: 'var(--font-poppins)',
                  }}
                >
                  Platform looks clean — no urgent items.
                </p>
              ) : (
                <ul className="divide-y divide-[#EEF0F8]">
                  {attention.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-start justify-between gap-3 px-5 py-3.5 transition hover:bg-[#FAFBFF]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <KindPill kind={item.kind} />
                            <p
                              className="truncate text-sm font-semibold"
                              style={{
                                color: colors.navy,
                                fontFamily: 'var(--font-poppins)',
                              }}
                            >
                              {item.title}
                            </p>
                          </div>
                          <p
                            className="mt-0.5 truncate text-xs"
                            style={{
                              color: colors.muted,
                              fontFamily: 'var(--font-poppins)',
                            }}
                          >
                            {item.subtitle}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {item.when ? (
                            <p
                              className="text-[11px]"
                              style={{
                                color: colors.muted,
                                fontFamily: 'var(--font-poppins)',
                              }}
                            >
                              {formatRelative(item.when)}
                            </p>
                          ) : null}
                          <p
                            className="mt-1 text-xs font-semibold text-[#202871]"
                            style={{ fontFamily: 'var(--font-poppins)' }}
                          >
                            Open →
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-sm">
              <h3
                className="text-base font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Quick actions
              </h3>
              <div className="mt-4 grid gap-2">
                <ActionLink
                  href="/admin/verification"
                  label="Review verification queue"
                  detail={`${verificationCounts.pending} pending`}
                />
                <ActionLink
                  href="/admin/jobs"
                  label="Moderate flagged jobs"
                  detail={`${jobCounts.flagged} flagged`}
                />
                <ActionLink
                  href="/admin/users"
                  label="Manage platform users"
                  detail={`${userCounts.total} total`}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-[#EEF0F8] bg-[#F7F8FE] p-5">
              <h3
                className="text-sm font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Snapshot
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <SnapshotRow
                  label="Companies"
                  value={String(userCounts.company)}
                />
                <SnapshotRow
                  label="Recruiters"
                  value={String(userCounts.recruiter)}
                />
                <SnapshotRow
                  label="Jobseekers"
                  value={String(userCounts.jobseeker)}
                />
                <SnapshotRow
                  label="Verification approved"
                  value={`${verificationCounts.approved}`}
                />
              </dl>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  hint,
  href,
  loading,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
  loading?: boolean;
  tone?: 'neutral' | 'warn' | 'danger';
}) {
  const accent =
    tone === 'danger'
      ? 'border-[#FFCDD2]'
      : tone === 'warn'
        ? 'border-[#FFE0B2]'
        : 'border-[#EEF0F8]';

  return (
    <Link
      href={href}
      className={`block rounded-2xl border bg-white px-5 py-4 shadow-sm transition hover:border-[#202871]/30 hover:shadow-md ${accent}`}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-semibold tabular-nums"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {loading ? '—' : value}
      </p>
      <p
        className="mt-1 text-xs"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {hint}
      </p>
    </Link>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-sm">
      <h3
        className="text-base font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {title}
      </h3>
      <p
        className="mt-0.5 text-xs"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {subtitle}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CompositionDonut({
  segments,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-40 w-40 shrink-0"
        role="img"
        aria-label={`${centerLabel} composition`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EEF0F8"
          strokeWidth={stroke}
        />
        {total === 0 ? null : (
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const el = (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>
                    {segment.label}: {segment.value}
                    {total > 0
                      ? ` (${Math.round((segment.value / total) * 100)}%)`
                      : ''}
                  </title>
                </circle>
              );
              offset += length;
              return el;
            })}
          </g>
        )}
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          style={{
            fill: colors.navy,
            fontSize: 22,
            fontWeight: 600,
            fontFamily: 'var(--font-poppins)',
          }}
        >
          {total}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          style={{
            fill: colors.muted,
            fontSize: 11,
            fontFamily: 'var(--font-poppins)',
          }}
        >
          {centerLabel}
        </text>
      </svg>
      <ul className="w-full space-y-2.5">
        {segments.map((segment) => {
          const pct =
            total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <li
              key={segment.label}
              className="flex items-center justify-between gap-3 text-sm"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              <span className="inline-flex items-center gap-2 text-[#42498A]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                {segment.label}
              </span>
              <span className="tabular-nums font-semibold text-[#202871]">
                {segment.value}
                <span
                  className="ml-1.5 text-xs font-medium"
                  style={{ color: colors.muted }}
                >
                  {pct}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActivityDualBars({
  labels,
  users,
  flags,
}: {
  labels: string[];
  users: number[];
  flags: number[];
}) {
  const max = Math.max(...users, ...flags, 1);
  const width = 560;
  const height = 160;
  const padX = 16;
  const padY = 20;
  const groupW = (width - padX * 2) / labels.length;
  const barW = Math.max(4, groupW * 0.28);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[160px] w-full"
      role="img"
      aria-label="Activity over last 7 days"
    >
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = height - padY - t * (height - padY * 2);
        return (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            stroke="#EEF0F8"
            strokeWidth={1}
          />
        );
      })}
      {labels.map((label, i) => {
        const baseX = padX + i * groupW + groupW / 2;
        const userH = (users[i] / max) * (height - padY * 2);
        const flagH = (flags[i] / max) * (height - padY * 2);
        return (
          <g key={label}>
            <rect
              x={baseX - barW - 2}
              y={height - padY - userH}
              width={barW}
              height={Math.max(userH, users[i] > 0 ? 2 : 0)}
              rx={2}
              fill="#202871"
              opacity={0.9}
            >
              <title>
                {label} users: {users[i]}
              </title>
            </rect>
            <rect
              x={baseX + 2}
              y={height - padY - flagH}
              width={barW}
              height={Math.max(flagH, flags[i] > 0 ? 2 : 0)}
              rx={2}
              fill="#EF6C00"
              opacity={0.9}
            >
              <title>
                {label} flags: {flags[i]}
              </title>
            </rect>
            <text
              x={baseX}
              y={height - 4}
              textAnchor="middle"
              style={{
                fill: colors.muted,
                fontSize: 10,
                fontFamily: 'var(--font-poppins)',
              }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KindPill({ kind }: { kind: AttentionItem['kind'] }) {
  const label =
    kind === 'verification' ? 'Verify' : kind === 'job' ? 'Job' : 'User';
  const style =
    kind === 'verification'
      ? { color: '#EF6C00', background: '#FFF3E0' }
      : kind === 'job'
        ? { color: '#C62828', background: '#FFEBEE' }
        : { color: '#202871', background: '#F2F6FF' };

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        color: style.color,
        backgroundColor: style.background,
        fontFamily: 'var(--font-poppins)',
      }}
    >
      {label}
    </span>
  );
}

function ActionLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-4 py-3 transition hover:border-[#202871]/25 hover:bg-white"
    >
      <span>
        <span
          className="block text-sm font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {label}
        </span>
        <span
          className="text-xs"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {detail}
        </span>
      </span>
      <span
        className="text-sm font-semibold text-[#202871]"
        style={{ fontFamily: 'var(--font-poppins)' }}
      >
        →
      </span>
    </Link>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </dt>
      <dd
        className="font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </dd>
    </div>
  );
}
