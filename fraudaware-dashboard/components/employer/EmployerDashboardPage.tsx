'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useEmployerWorkspace } from '@/components/employer/EmployerWorkspaceContext';
import { useInchat } from '@/components/recruiter/inchat/InchatProvider';
import { getEmailStatus } from '@/lib/api/emailApi';
import {
  listJobApplications,
  listMyJobs,
  type JobApplication,
  type JobSummary,
} from '@/lib/api/jobApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken, getStoredUser } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const PIPELINE_STAGES = [
  { value: 'applied', label: 'Applied', color: '#5B6473', track: '#EEF0F8' },
  { value: 'screened', label: 'Screened', color: '#EF6C00', track: '#FFF3E0' },
  { value: 'shortlisted', label: 'Shortlisted', color: '#1565C0', track: '#E3F2FD' },
  { value: 'interview', label: 'Interview', color: '#6A1B9A', track: '#F3E5F5' },
  { value: 'offered', label: 'Offered', color: '#2E7D32', track: '#E8F5E9' },
  { value: 'hired', label: 'Hired', color: '#1B5E20', track: '#C8E6C9' },
] as const;

type PipelineValue = (typeof PIPELINE_STAGES)[number]['value'];
type RangeKey = '7d' | '30d' | 'all';

const PIPELINE_SET = new Set<string>(PIPELINE_STAGES.map((s) => s.value));
const STALE_DAYS = 5;
const MS_DAY = 24 * 60 * 60 * 1000;

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function normalizePipelineStatus(status: string): PipelineValue | 'rejected' {
  if (status === 'sent' || status === 'pending') return 'applied';
  if (status === 'accepted') return 'shortlisted';
  if (status === 'rejected') return 'rejected';
  if (PIPELINE_SET.has(status)) return status as PipelineValue;
  return 'applied';
}

function statusLabel(status: string): string {
  const canonical = normalizePipelineStatus(status);
  if (canonical === 'rejected') return 'Rejected';
  return PIPELINE_STAGES.find((s) => s.value === canonical)?.label || canonical;
}

function statusStyles(status: string): { color: string; background: string } {
  const canonical = normalizePipelineStatus(status);
  if (canonical === 'hired' || canonical === 'offered') {
    return { color: '#2E7D32', background: '#E8F5E9' };
  }
  if (canonical === 'shortlisted') return { color: '#1565C0', background: '#E3F2FD' };
  if (canonical === 'interview') return { color: '#6A1B9A', background: '#F3E5F5' };
  if (canonical === 'screened') return { color: '#EF6C00', background: '#FFF3E0' };
  if (canonical === 'rejected') return { color: '#C62828', background: '#FFEBEE' };
  return { color: '#5B6473', background: '#EEF0F8' };
}

function jobStatusStyles(status: string): { color: string; background: string } {
  if (status === 'active') return { color: '#2E7D32', background: '#E8F5E9' };
  if (status === 'draft') return { color: '#EF6C00', background: '#FFF3E0' };
  if (status === 'pending_review') return { color: '#6A1B9A', background: '#F3E5F5' };
  return { color: '#C62828', background: '#FFEBEE' };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'A';
}

function formatAppliedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPosted(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatRelative(value: string): string {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  if (days < 14) return `${days}d ago`;
  return formatAppliedAt(value);
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function isEndingSoon(endsAt?: string): boolean {
  if (!endsAt) return false;
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return false;
  const now = Date.now();
  return end >= now && end - now <= 7 * MS_DAY;
}

function daysOpen(postedAt?: string): number | null {
  if (!postedAt) return null;
  const t = new Date(postedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / MS_DAY));
}

function ageDays(appliedAt: string): number {
  const t = new Date(appliedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / MS_DAY);
}

function rangeMs(range: RangeKey): number | null {
  if (range === '7d') return 7 * MS_DAY;
  if (range === '30d') return 30 * MS_DAY;
  return null;
}

function inWindow(iso: string | undefined, start: number, end: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start && t < end;
}

function isJobAtRisk(job: JobSummary): boolean {
  if (job.moderationStatus === 'flagged' || job.moderationStatus === 'force_closed') {
    return true;
  }
  const pred = job.riskCheck?.prediction?.toLowerCase();
  if (pred && (pred.includes('fake') || pred.includes('fraud') || pred === 'high')) {
    return true;
  }
  const prob = job.riskCheck?.fakeProbability;
  return typeof prob === 'number' && prob >= 0.6;
}

function applicantsHref(basePath: string, status?: string): string {
  if (!status) return `${basePath}/applicants`;
  return `${basePath}/applicants?status=${encodeURIComponent(status)}`;
}

async function fetchAllApplications(
  token: string,
  jobs: JobSummary[]
): Promise<JobApplication[]> {
  if (jobs.length === 0) return [];
  const titleById = new Map(jobs.map((job) => [job.id, job.title]));
  const batches = await Promise.all(
    jobs.map(async (job) => {
      const items = await listJobApplications(token, job.id);
      return items.map((item) => ({
        ...item,
        jobId: item.jobId || job.id,
        jobTitle: item.jobTitle || titleById.get(item.jobId || job.id) || job.title,
      }));
    })
  );
  return batches
    .flat()
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
}

function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-[0_2px_12px_rgba(32,40,113,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  href,
  iconBg,
  iconColor,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  hint: string;
  href: string;
  iconBg: string;
  iconColor: string;
  icon: ReactNode;
  trend?: { delta: number; label: string } | null;
}) {
  const trendPositive = trend && trend.delta > 0;
  const trendNegative = trend && trend.delta < 0;

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-[0_2px_12px_rgba(32,40,113,0.04)] transition hover:-translate-y-0.5 hover:border-[#D8DCF0] hover:shadow-[0_8px_24px_rgba(32,40,113,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          {trend && trend.delta !== 0 ? (
            <p
              className="mt-1.5 text-xs font-medium"
              style={{
                color: trendPositive ? '#2E7D32' : trendNegative ? '#C62828' : colors.muted,
                fontFamily: 'var(--font-poppins)',
              }}
            >
              {trend.delta > 0 ? '+' : ''}
              {trend.delta} {trend.label}
            </p>
          ) : (
            <p
              className="mt-1.5 truncate text-xs"
              style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
            >
              {hint}
            </p>
          )}
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-105"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
    </Link>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#EEF0F8] ${className ?? ''}`} />;
}

function pipelineDonutSegments(
  counts: Record<string, number>
): { color: string; value: number; label: string }[] {
  return PIPELINE_STAGES.map((stage) => ({
    color: stage.color,
    value: counts[stage.value] || 0,
    label: stage.label,
  })).filter((s) => s.value > 0);
}

function PipelineDonut({
  total,
  segments,
}: {
  total: number;
  segments: { color: string; value: number; label: string }[];
}) {
  const size = 140;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

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
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: colors.navy,
            fontSize: 22,
            fontWeight: 600,
            fontFamily: 'var(--font-poppins)',
          }}
        >
          0
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: colors.muted, fontSize: 10, fontFamily: 'var(--font-poppins)' }}
        >
          total
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#EEF0F8"
        strokeWidth={stroke}
      />
      {segments.map((seg) => {
        const length = (seg.value / total) * circumference;
        const dash = `${length} ${circumference - length}`;
        const el = (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += length;
        return el;
      })}
      <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
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
          y="62%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: colors.muted, fontSize: 10, fontFamily: 'var(--font-poppins)' }}
        >
          total
        </text>
      </g>
    </svg>
  );
}

export default function EmployerDashboardPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const config = portalConfigs[portal];
  const isCompany = portal === 'company';
  const {
    activeWorkspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useEmployerWorkspace();
  const activeWorkspaceId = activeWorkspace?.id;
  const { threadsForList } = useInchat();

  const user = getStoredUser();
  const displayName =
    user?.firstName || user?.fullName?.split(/\s+/)[0] || (isCompany ? 'team' : 'there');
  const workspaceName = activeWorkspace?.name || user?.company?.name || 'your workspace';

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [emailConnected, setEmailConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('7d');

  const unreadInchat = useMemo(
    () => (threadsForList ?? []).reduce((sum, thread) => sum + (thread.unreadCount || 0), 0),
    [threadsForList]
  );

  useEffect(() => {
    if (workspaceLoading) return;

    if (!activeWorkspaceId) {
      queueMicrotask(() => {
        setJobs([]);
        setApplications([]);
        setEmailConnected(null);
        setError(workspaceError || 'No active employer workspace is available.');
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    const token = getStoredToken();
    if (!token) {
      queueMicrotask(() => {
        setError('Your session has expired. Please sign in again.');
        setLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    Promise.all([
      listMyJobs(token, { limit: 50, workspaceId: activeWorkspaceId }),
      getEmailStatus(token).catch(() => null),
    ])
      .then(async ([jobsResult, status]) => {
        if (cancelled) return;
        const nextJobs = jobsResult.jobs;
        setJobs(nextJobs);
        if (status) setEmailConnected(status.connected);
        else setEmailConnected(null);

        try {
          const apps = await fetchAllApplications(token, nextJobs);
          if (!cancelled) setApplications(apps);
        } catch {
          if (!cancelled) setApplications([]);
        }
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load your dashboard.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, workspaceError, workspaceLoading]);

  const appsInRange = useMemo(() => {
    const ms = rangeMs(range);
    if (ms == null) return applications;
    const end = Date.now();
    const start = end - ms;
    return applications.filter((app) => inWindow(app.appliedAt, start, end + 1));
  }, [applications, range]);

  const appsPrevRange = useMemo(() => {
    const ms = rangeMs(range);
    if (ms == null) return [] as JobApplication[];
    const end = Date.now() - ms;
    const start = end - ms;
    return applications.filter((app) => inWindow(app.appliedAt, start, end));
  }, [applications, range]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === 'active'),
    [jobs]
  );

  const draftJobs = useMemo(
    () => jobs.filter((job) => job.status === 'draft'),
    [jobs]
  );

  const riskJobs = useMemo(() => jobs.filter(isJobAtRisk), [jobs]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) counts[stage.value] = 0;
    counts.rejected = 0;
    for (const app of appsInRange) {
      const key = normalizePipelineStatus(app.status);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [appsInRange]);

  const stageCountsAll = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) counts[stage.value] = 0;
    for (const app of applications) {
      const key = normalizePipelineStatus(app.status);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [applications]);

  const needsActionCount =
    (stageCountsAll.applied || 0) + (stageCountsAll.screened || 0);
  const needsActionInRange =
    (stageCounts.applied || 0) + (stageCounts.screened || 0);
  const prevNeedsAction = useMemo(() => {
    let n = 0;
    for (const app of appsPrevRange) {
      const s = normalizePipelineStatus(app.status);
      if (s === 'applied' || s === 'screened') n += 1;
    }
    return n;
  }, [appsPrevRange]);

  const appsTrendDelta = appsInRange.length - appsPrevRange.length;
  const needsTrendDelta = needsActionInRange - prevNeedsAction;

  const shortlistedCount = stageCountsAll.shortlisted || 0;
  const interviewCount = stageCountsAll.interview || 0;
  const pipelineSegments = useMemo(
    () => pipelineDonutSegments(stageCounts),
    [stageCounts]
  );
  const pipelineTotal = appsInRange.filter(
    (app) => normalizePipelineStatus(app.status) !== 'rejected'
  ).length;

  const endingSoon = useMemo(() => jobs.filter((job) => isEndingSoon(job.endsAt)), [jobs]);

  const staleApps = useMemo(
    () =>
      applications.filter((app) => {
        const s = normalizePipelineStatus(app.status);
        if (s !== 'applied' && s !== 'screened') return false;
        return ageDays(app.appliedAt) >= STALE_DAYS;
      }),
    [applications]
  );

  const avgQueueDays = useMemo(() => {
    const queue = applications.filter((app) => {
      const s = normalizePipelineStatus(app.status);
      return s === 'applied' || s === 'screened';
    });
    if (queue.length === 0) return null;
    const sum = queue.reduce((acc, app) => acc + ageDays(app.appliedAt), 0);
    return Math.round((sum / queue.length) * 10) / 10;
  }, [applications]);

  const attentionItems = useMemo(() => {
    const items: { id: string; title: string; detail: string; href: string; tone: string }[] =
      [];

    if (staleApps.length > 0) {
      items.push({
        id: 'stale',
        title: `${staleApps.length} waiting over ${STALE_DAYS} days`,
        detail: 'Still in Applied or Screened — review soon',
        href: applicantsHref(config.basePath, 'applied'),
        tone: '#C62828',
      });
    }
    if (needsActionCount > 0) {
      items.push({
        id: 'new-apps',
        title: `${needsActionCount} application${needsActionCount === 1 ? '' : 's'} need review`,
        detail: 'Applied or screened — move them forward',
        href: applicantsHref(config.basePath, 'applied'),
        tone: '#EF6C00',
      });
    }
    if (shortlistedCount > 0) {
      items.push({
        id: 'shortlist',
        title: `${shortlistedCount} shortlisted candidate${shortlistedCount === 1 ? '' : 's'}`,
        detail: 'Ready to schedule interviews',
        href: applicantsHref(config.basePath, 'shortlisted'),
        tone: '#1565C0',
      });
    }
    if (interviewCount > 0) {
      items.push({
        id: 'interview',
        title: `${interviewCount} in interview stage`,
        detail: 'Follow up or update outcomes',
        href: applicantsHref(config.basePath, 'interview'),
        tone: '#6A1B9A',
      });
    }
    if (draftJobs.length > 0) {
      items.push({
        id: 'drafts',
        title: `${draftJobs.length} draft job${draftJobs.length === 1 ? '' : 's'} unfinished`,
        detail: draftJobs
          .slice(0, 2)
          .map((j) => j.title)
          .join(', '),
        href: `${config.basePath}/jobs`,
        tone: '#EF6C00',
      });
    }
    if (riskJobs.length > 0) {
      items.push({
        id: 'risk',
        title: `${riskJobs.length} listing${riskJobs.length === 1 ? '' : 's'} need review`,
        detail: 'Flagged or elevated fraud risk',
        href: `${config.basePath}/jobs`,
        tone: '#C62828',
      });
    }
    if (emailConnected === false) {
      items.push({
        id: 'mailbox',
        title: 'Mailbox not connected',
        detail: 'Connect Google mail to email candidates',
        href: `${config.basePath}/profile`,
        tone: '#C62828',
      });
    }
    if (endingSoon.length > 0) {
      items.push({
        id: 'ending',
        title: `${endingSoon.length} job${endingSoon.length === 1 ? '' : 's'} ending soon`,
        detail: endingSoon
          .slice(0, 2)
          .map((j) => j.title)
          .join(', '),
        href: `${config.basePath}/jobs`,
        tone: '#202871',
      });
    }
    if (unreadInchat > 0) {
      items.push({
        id: 'inchat',
        title: `${unreadInchat} unread InChat message${unreadInchat === 1 ? '' : 's'}`,
        detail: 'Candidates may be waiting for a reply',
        href: `${config.basePath}/inchat`,
        tone: '#0288D1',
      });
    }
    return items;
  }, [
    config.basePath,
    draftJobs,
    emailConnected,
    endingSoon,
    interviewCount,
    needsActionCount,
    riskJobs,
    shortlistedCount,
    staleApps.length,
    unreadInchat,
  ]);

  const jobHealth = useMemo(() => {
    const byJob = new Map<string, JobApplication[]>();
    for (const app of applications) {
      const list = byJob.get(app.jobId) || [];
      list.push(app);
      byJob.set(app.jobId, list);
    }

    return activeJobs
      .map((job) => {
        const apps = byJob.get(job.id) || [];
        const advanced = apps.filter((a) => {
          const s = normalizePipelineStatus(a.status);
          return s === 'interview' || s === 'offered' || s === 'hired';
        }).length;
        const conversion =
          apps.length === 0 ? 0 : Math.round((advanced / apps.length) * 100);
        const openDays = daysOpen(job.postedAt);
        const recentApps = apps.filter((a) => ageDays(a.appliedAt) <= 7).length;
        return {
          job,
          apps: apps.length,
          conversion,
          openDays,
          recentApps,
          atRisk: isJobAtRisk(job),
          quiet: apps.length === 0 && (openDays ?? 0) >= 7,
        };
      })
      .sort((a, b) => b.apps - a.apps || (b.openDays ?? 0) - (a.openDays ?? 0))
      .slice(0, 4);
  }, [activeJobs, applications]);

  const interviewQueue = useMemo(
    () =>
      applications
        .filter((app) => normalizePipelineStatus(app.status) === 'interview')
        .slice(0, 4),
    [applications]
  );

  const activityFeed = useMemo(() => {
    return applications.slice(0, 6).map((app) => ({
      id: app.id,
      title: `${app.fullName} applied`,
      detail: `${app.jobTitle} · ${statusLabel(app.status)}`,
      when: formatRelative(app.appliedAt),
      href: applicantsHref(
        config.basePath,
        normalizePipelineStatus(app.status) === 'rejected'
          ? 'rejected'
          : normalizePipelineStatus(app.status)
      ),
    }));
  }, [applications, config.basePath]);

  const recentApplicants = applications.slice(0, 6);
  const recentJobs = [...jobs]
    .sort((a, b) => {
      const aTime = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const bTime = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const showEmptyJobs = !loading && !error && jobs.length === 0;
  const trendLabel = range === '7d' ? 'vs prior 7d' : range === '30d' ? 'vs prior 30d' : '';

  const quickActions = [
    { label: 'Post job', href: `${config.basePath}/jobs`, primary: true },
    {
      label: 'Review queue',
      href: applicantsHref(config.basePath, 'applied'),
      primary: false,
    },
    {
      label: unreadInchat > 0 ? `InChat (${unreadInchat})` : 'InChat',
      href: `${config.basePath}/inchat`,
      primary: false,
    },
    {
      label: emailConnected ? 'Mailbox' : 'Connect mail',
      href: emailConnected ? `${config.basePath}/email` : `${config.basePath}/profile`,
      primary: false,
    },
  ];

  return (
    <div className="space-y-5" style={{ fontFamily: 'var(--font-poppins)' }}>
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm" style={{ color: colors.muted }}>
            {todayLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: colors.navy }}>
            {greetingForNow()}, {displayName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: colors.body }}>
            <span>
              Hiring overview for <span className="font-medium">{workspaceName}</span>
            </span>
            <span
              className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: '#EEF0F8', color: colors.navy }}
            >
              {workspaceName}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="inline-flex self-start rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] p-1 sm:self-end">
            {RANGE_OPTIONS.map((opt) => {
              const active = range === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active ? 'bg-white text-[#202871] shadow-sm' : 'text-[#858BBD] hover:text-[#42498A]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={
                  action.primary
                    ? 'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-95'
                    : 'inline-flex items-center justify-center rounded-xl border border-[#E5E7EE] bg-white px-3.5 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE]'
                }
                style={
                  action.primary
                    ? { backgroundColor: colors.navy }
                    : { color: colors.navy }
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]">
          {error}
        </div>
      ) : null}

      {/* KPI strip */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-[118px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Active jobs"
            value={activeJobs.length}
            hint={`${jobs.length} total · ${draftJobs.length} draft`}
            href={`${config.basePath}/jobs`}
            iconBg="#E8EAF6"
            iconColor={colors.navy}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 14.15v4.25a2.25 2.25 0 01-2.25 2.25h-12a2.25 2.25 0 01-2.25-2.25v-4.25m16.5 0a2.25 2.25 0 002.25-2.25V8.25A2.25 2.25 0 0018.75 6h-1.5a2.25 2.25 0 01-2.25-2.25V3.75A2.25 2.25 0 0012.75 1.5h-1.5A2.25 2.25 0 009 3.75v.75A2.25 2.25 0 016.75 6h-1.5A2.25 2.25 0 003 8.25v3.65a2.25 2.25 0 002.25 2.25m16.5 0h-16.5"
                />
              </svg>
            }
          />
          <KpiCard
            label={range === 'all' ? 'New applicants' : 'Applicants'}
            value={appsInRange.length}
            hint={range === 'all' ? 'All time' : `In selected range`}
            href={applicantsHref(config.basePath)}
            trend={
              range !== 'all' && appsTrendDelta !== 0
                ? { delta: appsTrendDelta, label: trendLabel }
                : null
            }
            iconBg="#E3F2FD"
            iconColor="#1565C0"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            }
          />
          <KpiCard
            label="Needs action"
            value={needsActionCount}
            hint="Applied + screened"
            href={applicantsHref(config.basePath, 'applied')}
            trend={
              range !== 'all' && needsTrendDelta !== 0
                ? { delta: needsTrendDelta, label: trendLabel }
                : null
            }
            iconBg="#FFF3E0"
            iconColor="#EF6C00"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <KpiCard
            label="Queue age"
            value={avgQueueDays == null ? '—' : `${avgQueueDays}d`}
            hint="Avg days in Applied/Screened"
            href={applicantsHref(config.basePath, 'applied')}
            iconBg="#F3E5F5"
            iconColor="#6A1B9A"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <KpiCard
            label="Unread / Mail"
            value={unreadInchat}
            hint={
              emailConnected === null
                ? 'Mailbox —'
                : emailConnected
                  ? 'Mailbox on'
                  : 'Mailbox off'
            }
            href={
              unreadInchat > 0
                ? `${config.basePath}/inchat`
                : emailConnected
                  ? `${config.basePath}/email`
                  : `${config.basePath}/profile`
            }
            iconBg={emailConnected === false ? '#FFEBEE' : '#E1F5FE'}
            iconColor={emailConnected === false ? '#C62828' : '#0288D1'}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.199C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            }
          />
        </div>
      )}

      {showEmptyJobs ? (
        <Card className="flex flex-col gap-5 p-8">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: colors.navy }}>
              Get hiring set up in 3 steps
            </h2>
            <p className="mt-1 max-w-xl text-sm" style={{ color: colors.body }}>
              Your dashboard fills with pipeline health, attention items, and recent activity
              once jobs and applicants start flowing.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { step: '1', title: 'Post a job', href: `${config.basePath}/jobs`, body: 'Publish an active listing' },
              {
                step: '2',
                title: 'Connect mailbox',
                href: `${config.basePath}/profile`,
                body: 'Email candidates from FraudAware',
              },
              {
                step: '3',
                title: 'Review applicants',
                href: applicantsHref(config.basePath),
                body: 'Move people through the pipeline',
              },
            ].map((item) => (
              <Link
                key={item.step}
                href={item.href}
                className="rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] p-4 transition hover:border-[#D8DCF0] hover:bg-white"
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: colors.navy }}
                >
                  {item.step}
                </span>
                <p className="mt-3 text-sm font-semibold" style={{ color: colors.navy }}>
                  {item.title}
                </p>
                <p className="mt-1 text-xs" style={{ color: colors.muted }}>
                  {item.body}
                </p>
              </Link>
            ))}
          </ol>
        </Card>
      ) : null}

      {/* Interviews teaser */}
      {!loading && interviewQueue.length > 0 ? (
        <Card className="border-[#E1BEE7] bg-gradient-to-r from-[#FBF7FF] to-white">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
                Interview pipeline
              </h2>
              <p className="text-xs" style={{ color: colors.muted }}>
                Candidates currently in Interview — full calendar coming in Interviews
              </p>
            </div>
            <Link
              href={`${config.basePath}/interviews`}
              className="text-xs font-medium hover:underline"
              style={{ color: colors.navy }}
            >
              View all
            </Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {interviewQueue.map((app) => (
              <li key={app.id}>
                  <Link
                    href={`${config.basePath}/interviews`}
                    className="flex items-center gap-3 rounded-xl border border-[#EEF0F8] bg-white px-3 py-2.5 transition hover:border-[#D8DCF0]"
                  >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ backgroundColor: '#F3E5F5', color: '#6A1B9A' }}
                  >
                    {initialsFromName(app.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" style={{ color: colors.navy }}>
                      {app.fullName}
                    </span>
                    <span className="block truncate text-xs" style={{ color: colors.muted }}>
                      {app.jobTitle}
                    </span>
                  </span>
                  <span className="text-[11px]" style={{ color: colors.muted }}>
                    {formatRelative(app.appliedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Middle: pipeline + attention */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
                Pipeline snapshot
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: colors.muted }}>
                {pipelineTotal} in pipeline
                {range !== 'all' ? ` · applied in selected range` : ' · all applicants'}
              </p>
            </div>
            <Link
              href={applicantsHref(config.basePath)}
              className="text-xs font-medium transition hover:underline"
              style={{ color: colors.navy }}
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonBlock key={i} className="h-[72px]" />
              ))}
            </div>
          ) : appsInRange.length === 0 && applications.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
              No applications yet. Share your active jobs to start the pipeline.
            </p>
          ) : appsInRange.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
              No applications in this range. Try 30 days or All time.
            </p>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="mx-auto shrink-0 sm:mx-0">
                <PipelineDonut total={pipelineTotal} segments={pipelineSegments} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {PIPELINE_STAGES.map((stage) => {
                    const count = stageCounts[stage.value] || 0;
                    const active = count > 0;
                    return (
                      <Link
                        key={stage.value}
                        href={applicantsHref(config.basePath, stage.value)}
                        className="rounded-xl border px-3 py-3 transition hover:shadow-sm"
                        style={{
                          borderColor: active ? stage.color : '#EEF0F8',
                          backgroundColor: active ? stage.track : '#FAFBFF',
                        }}
                      >
                        <p
                          className="text-xl font-semibold tabular-nums leading-none"
                          style={{ color: active ? stage.color : colors.muted }}
                        >
                          {count}
                        </p>
                        <p className="mt-1.5 text-xs font-medium" style={{ color: colors.navy }}>
                          {stage.label}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                {(stageCounts.rejected || 0) > 0 ? (
                  <p className="mt-3 text-xs" style={{ color: colors.muted }}>
                    Also {stageCounts.rejected} rejected in range
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
              Needs attention
            </h2>
            {attentionItems.length > 0 ? (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: colors.navy }}
              >
                {attentionItems.length}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} className="h-16" />
              ))}
            </div>
          ) : attentionItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: colors.navy }}>
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-xs" style={{ color: colors.muted }}>
                No urgent hiring actions right now
              </p>
            </div>
          ) : (
            <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-0.5">
              {attentionItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-3 py-3 transition hover:border-[#D8DCF0] hover:bg-white"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.tone }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium" style={{ color: colors.navy }}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs" style={{ color: colors.muted }}>
                        {item.detail}
                      </span>
                    </span>
                    <svg
                      className="mt-1 h-4 w-4 shrink-0 text-[#858BBD]"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.6}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div
            className="relative mt-4 overflow-hidden rounded-2xl p-4 text-white"
            style={{
              background: 'linear-gradient(135deg, #202871 0%, #3A4699 55%, #5B6BC8 100%)',
            }}
          >
            <p className="text-sm font-semibold">Hire faster with InChat</p>
            <p className="mt-1 text-xs text-white/80">
              Message shortlisted candidates without leaving FraudAware.
            </p>
            <Link
              href={`${config.basePath}/inchat`}
              className="mt-3 inline-flex rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-white/25"
            >
              Open InChat
            </Link>
          </div>
        </Card>
      </div>

      {/* Job health + activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
                Job health
              </h2>
              <p className="text-xs" style={{ color: colors.muted }}>
                Top active roles · conversion to Interview+
              </p>
            </div>
            <Link
              href={`${config.basePath}/jobs`}
              className="text-xs font-medium hover:underline"
              style={{ color: colors.navy }}
            >
              Manage
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} className="h-14" />
              ))}
            </div>
          ) : jobHealth.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
              No active jobs yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {jobHealth.map((row) => (
                <li key={row.job.id}>
                  <Link
                    href={`${config.basePath}/jobs/${row.job.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-[#EEF0F8] px-3 py-3 transition hover:border-[#D8DCF0] hover:bg-[#F7F8FE]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium" style={{ color: colors.navy }}>
                          {row.job.title}
                        </p>
                        {row.atRisk ? (
                          <span className="rounded-full bg-[#FFEBEE] px-2 py-0.5 text-[10px] font-semibold text-[#C62828]">
                            Risk
                          </span>
                        ) : null}
                        {row.quiet ? (
                          <span className="rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[10px] font-semibold text-[#EF6C00]">
                            Quiet
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: colors.muted }}>
                        {row.apps} applicant{row.apps === 1 ? '' : 's'}
                        {row.openDays != null ? ` · ${row.openDays}d open` : ''}
                        {row.recentApps > 0 ? ` · ${row.recentApps} this week` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: colors.navy }}>
                        {row.conversion}%
                      </p>
                      <p className="text-[10px]" style={{ color: colors.muted }}>
                        to interview+
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
              Recent activity
            </h2>
            <Link
              href={applicantsHref(config.basePath)}
              className="text-xs font-medium hover:underline"
              style={{ color: colors.navy }}
            >
              Applicants
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} className="h-12" />
              ))}
            </div>
          ) : activityFeed.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
              Activity will show as people apply.
            </p>
          ) : (
            <ul className="space-y-2">
              {activityFeed.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-[#F7F8FE]"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colors.periwinkle }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium" style={{ color: colors.navy }}>
                        {item.title}
                      </span>
                      <span className="block truncate text-xs" style={{ color: colors.muted }}>
                        {item.detail}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px]" style={{ color: colors.muted }}>
                      {item.when}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Bottom: recent applicants + jobs */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="overflow-hidden p-0 xl:col-span-3">
          <div className="flex items-center justify-between gap-3 border-b border-[#EEF0F8] px-5 py-4">
            <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
              Recent applicants
            </h2>
            <Link
              href={applicantsHref(config.basePath)}
              className="text-xs font-medium hover:underline"
              style={{ color: colors.navy }}
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-12" />
              ))}
            </div>
          ) : recentApplicants.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm" style={{ color: colors.muted }}>
              New applicants will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr
                    className="border-b border-[#EEF0F8] text-xs uppercase tracking-wide"
                    style={{ color: colors.muted }}
                  >
                    <th className="px-5 py-3 font-medium">Candidate</th>
                    <th className="px-3 py-3 font-medium">Job</th>
                    <th className="px-3 py-3 font-medium">Stage</th>
                    <th className="px-5 py-3 font-medium">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {recentApplicants.map((app) => {
                    const styles = statusStyles(app.status);
                    const stage = normalizePipelineStatus(app.status);
                    return (
                      <tr
                        key={app.id}
                        className="border-b border-[#F4F5FB] last:border-0 transition hover:bg-[#F7F8FE]"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={applicantsHref(
                              config.basePath,
                              stage === 'rejected' ? 'rejected' : stage
                            )}
                            className="flex items-center gap-3"
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                              style={{ backgroundColor: '#EEF0F8', color: colors.navy }}
                            >
                              {initialsFromName(app.fullName)}
                            </span>
                            <span className="min-w-0">
                              <span
                                className="block truncate text-sm font-medium"
                                style={{ color: colors.navy }}
                              >
                                {app.fullName}
                              </span>
                              <span
                                className="block truncate text-xs"
                                style={{ color: colors.muted }}
                              >
                                {app.email}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td
                          className="max-w-[140px] truncate px-3 py-3 text-sm"
                          style={{ color: colors.body }}
                        >
                          {app.jobTitle}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{ color: styles.color, backgroundColor: styles.background }}
                          >
                            {statusLabel(app.status)}
                          </span>
                        </td>
                        <td
                          className="px-5 py-3 text-sm tabular-nums"
                          style={{ color: colors.muted }}
                        >
                          {formatAppliedAt(app.appliedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold" style={{ color: colors.navy }}>
              Your jobs
            </h2>
            <Link
              href={`${config.basePath}/jobs`}
              className="text-xs font-medium hover:underline"
              style={{ color: colors.navy }}
            >
              Manage
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} className="h-14" />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.muted }}>
              No jobs yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentJobs.map((job) => {
                const styles = jobStatusStyles(String(job.status));
                const atRisk = isJobAtRisk(job);
                return (
                  <li key={job.id}>
                    <Link
                      href={`${config.basePath}/jobs/${job.id}`}
                      className="flex items-center gap-3 rounded-xl border border-[#EEF0F8] px-3 py-3 transition hover:border-[#D8DCF0] hover:bg-[#F7F8FE]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium" style={{ color: colors.navy }}>
                            {job.title}
                          </p>
                          {atRisk ? (
                            <span className="shrink-0 rounded-full bg-[#FFEBEE] px-1.5 py-0.5 text-[10px] font-semibold text-[#C62828]">
                              Risk
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs" style={{ color: colors.muted }}>
                          {job.applicants ?? 0} applicant{(job.applicants ?? 0) === 1 ? '' : 's'} ·{' '}
                          {formatPosted(job.postedAt)}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize"
                        style={{ color: styles.color, backgroundColor: styles.background }}
                      >
                        {String(job.status).replace(/_/g, ' ')}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
