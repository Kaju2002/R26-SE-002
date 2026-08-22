'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useEmployerWorkspace } from '@/components/employer/EmployerWorkspaceContext';
import {
  getEmployerAnalytics,
  type AnalyticsFunnel,
  type AnalyticsRangeKey,
  type EmployerAnalytics,
} from '@/lib/api/analyticsApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const PIPELINE_STAGES = [
  { value: 'applied', label: 'Applied', color: '#5B6473' },
  { value: 'screened', label: 'Screened', color: '#EF6C00' },
  { value: 'shortlisted', label: 'Shortlisted', color: '#1565C0' },
  { value: 'interview', label: 'Interview', color: '#6A1B9A' },
  { value: 'offered', label: 'Offered', color: '#2E7D32' },
  { value: 'hired', label: 'Hired', color: '#1B5E20' },
] as const;

const RANGE_OPTIONS: { value: AnalyticsRangeKey; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function KpiCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  href?: string;
}) {
  const inner = (
    <>
      <p
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-semibold tabular-nums tracking-tight"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </p>
      <p
        className="mt-1.5 truncate text-xs"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {hint}
      </p>
    </>
  );

  const className =
    'rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-[0_2px_12px_rgba(32,40,113,0.04)] transition hover:border-[#D8DCF0]';

  if (href) {
    return (
      <Link href={href} className={`${className} block hover:-translate-y-0.5`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function PipelineDonut({
  total,
  funnel,
}: {
  total: number;
  funnel: AnalyticsFunnel;
}) {
  const size = 160;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    value: funnel[stage.value] || 0,
  })).filter((s) => s.value > 0);

  if (total === 0 || segments.length === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EEF0F8"
          strokeWidth={stroke}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: colors.navy, fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-poppins)' }}
        >
          0
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto -rotate-90">
      {segments.map((seg) => {
        const length = (seg.value / total) * circumference;
        const el = (
          <circle
            key={seg.value}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += length;
        return el;
      })}
      <g className="rotate-90 origin-center" style={{ transformOrigin: 'center' }}>
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: colors.navy,
            fontSize: 26,
            fontWeight: 600,
            fontFamily: 'var(--font-poppins)',
          }}
        >
          {total}
        </text>
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: colors.muted,
            fontSize: 11,
            fontFamily: 'var(--font-poppins)',
          }}
        >
          applicants
        </text>
      </g>
    </svg>
  );
}

function ApplicantsBarChart({
  days,
  values,
}: {
  days: string[];
  values: number[];
}) {
  const max = Math.max(...values, 1);
  const width = 560;
  const height = 140;
  const padX = 8;
  const padY = 12;
  const barGap = 2;
  const barW = Math.max(2, (width - padX * 2) / values.length - barGap);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[140px] w-full"
      role="img"
      aria-label="Applicants over time"
    >
      {values.map((v, i) => {
        const h = (v / max) * (height - padY * 2);
        const x = padX + i * (barW + barGap);
        const y = height - padY - h;
        return (
          <rect
            key={days[i] || i}
            x={x}
            y={y}
            width={barW}
            height={Math.max(h, v > 0 ? 2 : 0)}
            rx={2}
            fill={v > 0 ? '#202871' : '#EEF0F8'}
            opacity={v > 0 ? 0.85 : 1}
          >
            <title>
              {days[i]}: {v}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-[0_2px_12px_rgba(32,40,113,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="text-base font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function EmployerAnalyticsPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const config = portalConfigs[portal];
  const {
    activeWorkspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useEmployerWorkspace();
  const workspaceId = activeWorkspace?.id;

  const [range, setRange] = useState<AnalyticsRangeKey>('30d');
  const [data, setData] = useState<EmployerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in required');
      setLoading(false);
      return;
    }
    if (workspaceLoading) return;
    if (workspaceError || !workspaceId) {
      setError(workspaceError || 'No workspace');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getEmployerAnalytics(token, { range, workspaceId });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range, workspaceError, workspaceId, workspaceLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const funnelTotal = useMemo(() => {
    if (!data) return 0;
    const f = data.funnel;
    return (
      f.applied +
      f.screened +
      f.shortlisted +
      f.interview +
      f.offered +
      f.hired
    );
  }, [data]);

  const applicantsHref = `${config.basePath}/applicants`;
  const jobsHref = `${config.basePath}/jobs`;
  const interviewsHref = `${config.basePath}/interviews`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Analytics
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Pipeline conversion, job health, and hiring volume for{' '}
            {activeWorkspace?.name || 'your workspace'}.
          </p>
        </div>
        <div className="flex rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                range === opt.value
                  ? 'bg-[#202871] text-white shadow-sm'
                  : 'text-[#42498A] hover:bg-white'
              }`}
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600" style={{ fontFamily: 'var(--font-poppins)' }}>
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#EEF0F8]" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Active jobs"
              value={data.kpis.activeJobs}
              hint={`${data.kpis.totalJobs} total jobs`}
              href={jobsHref}
            />
            <KpiCard
              label="Applicants"
              value={data.kpis.applicants}
              hint={
                data.kpis.applicantsDelta !== 0
                  ? `${data.kpis.applicantsDelta > 0 ? '+' : ''}${data.kpis.applicantsDelta} vs prior period`
                  : 'In selected range'
              }
              href={applicantsHref}
            />
            <KpiCard
              label="Needs action"
              value={data.kpis.needsAction}
              hint="Applied + screened"
              href={`${applicantsHref}?status=applied`}
            />
            <KpiCard
              label="Interviews this week"
              value={data.kpis.interviewsThisWeek}
              hint="Scheduled on calendar"
              href={interviewsHref}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Hired"
              value={data.kpis.hired}
              hint={`${data.kpis.conversionToHire}% of applicants`}
            />
            <KpiCard
              label="Rejected"
              value={data.kpis.rejected}
              hint="Closed without hire"
            />
            <KpiCard
              label="→ Interview"
              value={`${data.kpis.conversionToInterview}%`}
              hint="Reached interview / offer / hired"
            />
            <KpiCard
              label="Avg queue age"
              value={
                data.kpis.avgQueueDays != null ? `${data.kpis.avgQueueDays}d` : '—'
              }
              hint="Applied + screened waiting"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Section title="Hiring funnel">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <PipelineDonut total={funnelTotal} funnel={data.funnel} />
                <ul className="w-full flex-1 space-y-2">
                  {PIPELINE_STAGES.map((stage) => {
                    const count = data.funnel[stage.value] || 0;
                    const pct =
                      funnelTotal > 0
                        ? Math.round((count / funnelTotal) * 1000) / 10
                        : 0;
                    return (
                      <li key={stage.value} className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span
                          className="min-w-0 flex-1 text-sm"
                          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                        >
                          {stage.label}
                        </span>
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {count}
                        </span>
                        <span
                          className="w-12 text-right text-xs tabular-nums"
                          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                        >
                          {pct}%
                        </span>
                      </li>
                    );
                  })}
                  {data.funnel.rejected > 0 ? (
                    <li className="flex items-center gap-3 border-t border-[#EEF0F8] pt-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#C62828]" />
                      <span
                        className="min-w-0 flex-1 text-sm"
                        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                      >
                        Rejected
                      </span>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                      >
                        {data.funnel.rejected}
                      </span>
                      <span className="w-12" />
                    </li>
                  ) : null}
                </ul>
              </div>
            </Section>

            <Section
              title="Applicants over time"
              action={
                <span
                  className="text-xs"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  {range === 'all' ? 'Last 30 days' : RANGE_OPTIONS.find((r) => r.value === range)?.label}
                </span>
              }
            >
              {data.series.applicants.every((n) => n === 0) ? (
                <p
                  className="py-10 text-center text-sm"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  No applications in this window yet.
                </p>
              ) : (
                <ApplicantsBarChart days={data.series.days} values={data.series.applicants} />
              )}
            </Section>
          </div>

          <div className="mt-6">
            <Section title="Jobs breakdown">
              {data.byJob.length === 0 ? (
                <p
                  className="py-8 text-center text-sm"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  No jobs yet.{' '}
                  <Link href={`${jobsHref}/new`} className="font-semibold text-[#202871] underline">
                    Post a job
                  </Link>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#EEF0F8]">
                        {['Job', 'Status', 'Applicants', '→ Interview', 'Hired', 'Conv. %', 'Open'].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-2 py-2 text-xs font-semibold uppercase tracking-wide"
                              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.byJob.map((row) => (
                        <tr key={row.jobId} className="border-b border-[#F4F5FA]">
                          <td className="px-2 py-3">
                            <Link
                              href={applicantsHref}
                              className="font-semibold text-[#202871] hover:underline"
                              style={{ fontFamily: 'var(--font-poppins)' }}
                            >
                              {row.title}
                            </Link>
                          </td>
                          <td
                            className="px-2 py-3 capitalize"
                            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                          >
                            {row.status.replace('_', ' ')}
                          </td>
                          <td
                            className="px-2 py-3 tabular-nums font-medium"
                            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                          >
                            {row.applicants}
                          </td>
                          <td
                            className="px-2 py-3 tabular-nums"
                            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                          >
                            {row.reachedInterview}
                          </td>
                          <td
                            className="px-2 py-3 tabular-nums"
                            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                          >
                            {row.hired}
                          </td>
                          <td
                            className="px-2 py-3 tabular-nums"
                            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                          >
                            {row.conversionPct}%
                          </td>
                          <td
                            className="px-2 py-3 tabular-nums"
                            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                          >
                            {row.openDays}d
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        </>
      ) : null}
    </div>
  );
}
