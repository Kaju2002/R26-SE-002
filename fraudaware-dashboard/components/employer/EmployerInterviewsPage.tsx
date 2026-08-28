'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import InterviewCalendar from '@/components/employer/InterviewCalendar';
import ScheduleInterviewModal from '@/components/employer/ScheduleInterviewModal';
import { useEmployerWorkspace } from '@/components/employer/EmployerWorkspaceContext';
import { getEmailStatus } from '@/lib/api/emailApi';
import {
  cancelInterview,
  listInterviews,
  rescheduleInterview,
  updateInterviewStatus,
  type Interview,
} from '@/lib/api/interviewApi';
import {
  listJobApplications,
  listMyJobs,
  type JobApplication,
} from '@/lib/api/jobApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

function formatWhen(iso: string, timezone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleString();
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'I';
}

export default function EmployerInterviewsPage({
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
  const activeWorkspaceId = activeWorkspace?.id;

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<
    { applicationId: string; fullName: string; email: string; jobTitle: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mailboxConnected, setMailboxConnected] = useState<boolean | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [slotStartsAt, setSlotStartsAt] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [layout, setLayout] = useState<'agenda' | 'week' | 'month'>('week');
  const [agendaFilter, setAgendaFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token || !activeWorkspaceId) return;

    setLoading(true);
    setError(null);

    try {
      const [list, jobsResult, emailStatus] = await Promise.all([
        listInterviews(token, { status: 'all', limit: 100 }),
        listMyJobs(token, { limit: 50, workspaceId: activeWorkspaceId }),
        getEmailStatus(token).catch(() => null),
      ]);

      setInterviews(list);
      setMailboxConnected(emailStatus?.connected ?? null);

      const appsBatches = await Promise.all(
        jobsResult.jobs.map(async (job) => {
          const apps = await listJobApplications(token, job.id);
          return apps.map((app) => ({
            ...app,
            jobTitle: app.jobTitle || job.title,
          }));
        })
      );

      const schedulable = appsBatches
        .flat()
        .filter((app: JobApplication) => {
          const s = app.status;
          return (
            s === 'shortlisted' ||
            s === 'interview' ||
            s === 'accepted' ||
            s === 'screened'
          );
        })
        .map((app) => ({
          applicationId: app.id,
          fullName: app.fullName,
          email: app.email,
          jobTitle: app.jobTitle,
        }));

      setCandidates(schedulable);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load interviews.'
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (workspaceLoading) return;
    if (!activeWorkspaceId) {
      queueMicrotask(() => {
        setInterviews([]);
        setError(workspaceError || 'No active employer workspace is available.');
        setLoading(false);
      });
      return;
    }
    void load();
  }, [activeWorkspaceId, load, workspaceError, workspaceLoading]);

  const now = Date.now();

  const filtered = useMemo(() => {
    const sorted = [...interviews].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
    if (agendaFilter === 'all') return sorted;
    if (agendaFilter === 'upcoming') {
      return sorted.filter(
        (i) =>
          i.status === 'scheduled' && new Date(i.startsAt).getTime() >= now - 60 * 60 * 1000
      );
    }
    return sorted.filter(
      (i) =>
        i.status !== 'scheduled' || new Date(i.startsAt).getTime() < now - 60 * 60 * 1000
    );
  }, [interviews, now, agendaFilter]);

  const handleReschedule = useCallback(
    async (interviewId: string, startsAt: Date, endsAt: Date) => {
      const token = getStoredToken();
      if (!token) return;
      setRescheduleBusy(true);
      setError(null);
      try {
        const result = await rescheduleInterview(token, interviewId, {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
        const warn =
          result.warnings.length > 0 ? ` (${result.warnings.join('; ')})` : '';
        setInfo(`Rescheduled ${result.interview.candidateName}${warn}`);
        await load();
      } catch (requestError: unknown) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not reschedule interview.'
        );
      } finally {
        setRescheduleBusy(false);
      }
    },
    [load]
  );

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: Interview[] }[] = [];
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    for (const item of filtered) {
      const start = new Date(item.startsAt);
      let label = start.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      if (isSameDay(start, today)) label = 'Today';
      else if (isSameDay(start, tomorrow)) label = 'Tomorrow';

      const key = start.toISOString().slice(0, 10);
      const existing = groups.find((g) => g.key === key);
      if (existing) existing.items.push(item);
      else groups.push({ key, label, items: [item] });
    }
    return groups;
  }, [filtered]);

  const handleCancel = async (interview: Interview) => {
    const token = getStoredToken();
    if (!token) return;
    setBusyId(interview.id);
    setError(null);
    try {
      await cancelInterview(token, interview.id);
      setInfo(`Cancelled interview with ${interview.candidateName}`);
      await load();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not cancel interview.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (interview: Interview) => {
    const token = getStoredToken();
    if (!token) return;
    setBusyId(interview.id);
    try {
      await updateInterviewStatus(token, interview.id, 'completed');
      setInfo(`Marked completed: ${interview.candidateName}`);
      await load();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update interview.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5" style={{ fontFamily: 'var(--font-poppins)' }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: colors.navy }}>
            Interviews
          </h1>
          <p className="mt-1 text-sm" style={{ color: colors.body }}>
            Week / month calendar with drag-to-reschedule · Meet / Teams via mailbox
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${config.basePath}/profile`}
            className="rounded-xl border border-[#E5E7EE] bg-white px-4 py-2 text-sm font-medium transition hover:bg-[#F7F8FE]"
            style={{ color: colors.navy }}
          >
            {mailboxConnected ? 'Mailbox connected' : 'Connect mailbox'}
          </Link>
          <button
            type="button"
            onClick={() => {
              setSlotStartsAt(null);
              setScheduleOpen(true);
            }}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: colors.navy }}
          >
            Schedule interview
          </button>
        </div>
      </div>

      {mailboxConnected === false ? (
        <div className="rounded-2xl border border-[#FFE0B2] bg-[#FFF8E1] px-4 py-3 text-sm text-[#EF6C00]">
          Connect Google or Microsoft in Profile so CareerNet can create calendar events and
          auto-generate Meet/Teams links. You can still paste a manual link when scheduling.
        </div>
      ) : null}

      {info ? (
        <div className="rounded-2xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]">
          {info}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] p-1">
          {(
            [
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'agenda', label: 'Agenda' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLayout(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                layout === tab.id
                  ? 'bg-white text-[#202871] shadow-sm'
                  : 'text-[#858BBD] hover:text-[#42498A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {layout === 'agenda' ? (
          <div className="inline-flex rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] p-1">
            {(
              [
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'past', label: 'Past' },
                { id: 'all', label: 'All' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAgendaFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  agendaFilter === tab.id
                    ? 'bg-white text-[#202871] shadow-sm'
                    : 'text-[#858BBD] hover:text-[#42498A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {layout === 'week' || layout === 'month' ? (
        loading ? (
          <p className="rounded-2xl border border-[#EEF0F8] bg-white px-5 py-12 text-center text-sm" style={{ color: colors.muted }}>
            Loading calendar…
          </p>
        ) : (
          <InterviewCalendar
            mode={layout}
            interviews={interviews}
            anchorDate={anchorDate}
            onAnchorChange={setAnchorDate}
            busy={rescheduleBusy}
            onReschedule={handleReschedule}
            onSlotClick={(startsAt) => {
              setSlotStartsAt(startsAt);
              setScheduleOpen(true);
            }}
            onSelectInterview={(interview) => {
              setInfo(
                `${interview.candidateName} · ${formatWhen(interview.startsAt, interview.timezone)}`
              );
            }}
          />
        )
      ) : null}

      {layout === 'agenda' ? (
      <div className="rounded-2xl border border-[#EEF0F8] bg-white shadow-[0_2px_12px_rgba(32,40,113,0.04)]">
        {loading ? (
          <p className="px-5 py-12 text-center text-sm" style={{ color: colors.muted }}>
            Loading interviews…
          </p>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium" style={{ color: colors.navy }}>
              No interviews in this view
            </p>
            <p className="mt-1 text-xs" style={{ color: colors.muted }}>
              Shortlist a candidate, then schedule with Meet or Teams.
            </p>
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="mt-4 rounded-xl px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: colors.navy }}
            >
              Schedule interview
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#EEF0F8]">
            {grouped.map((group) => (
              <section key={group.key} className="px-5 py-4">
                <h2
                  className="mb-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: colors.muted }}
                >
                  {group.label}
                </h2>
                <ul className="space-y-2">
                  {group.items.map((interview) => (
                    <li
                      key={interview.id}
                      className="flex flex-col gap-3 rounded-xl border border-[#EEF0F8] px-4 py-3 sm:flex-row sm:items-center"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: '#F3E5F5', color: '#6A1B9A' }}
                      >
                        {initials(interview.candidateName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold" style={{ color: colors.navy }}>
                            {interview.candidateName}
                          </p>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                            style={{
                              backgroundColor:
                                interview.status === 'scheduled'
                                  ? '#F3E5F5'
                                  : interview.status === 'completed'
                                    ? '#E8F5E9'
                                    : '#FFEBEE',
                              color:
                                interview.status === 'scheduled'
                                  ? '#6A1B9A'
                                  : interview.status === 'completed'
                                    ? '#2E7D32'
                                    : '#C62828',
                            }}
                          >
                            {interview.status.replace(/_/g, ' ')}
                          </span>
                          <span className="rounded-full bg-[#EEF0F8] px-2 py-0.5 text-[10px] font-medium capitalize text-[#42498A]">
                            {interview.type}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs" style={{ color: colors.muted }}>
                          {interview.jobTitle} ·{' '}
                          {formatWhen(interview.startsAt, interview.timezone)}
                        </p>
                        {interview.conferenceUrl ? (
                          <a
                            href={interview.conferenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-medium hover:underline"
                            style={{ color: colors.navy }}
                          >
                            Join {interview.conferenceProvider || 'video'}
                          </a>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {interview.status === 'scheduled' ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === interview.id}
                              onClick={() => void handleComplete(interview)}
                              className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FE]"
                              style={{ color: colors.navy }}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              disabled={busyId === interview.id}
                              onClick={() => void handleCancel(interview)}
                              className="rounded-lg border border-[#FFCDD2] px-3 py-1.5 text-xs font-medium text-[#C62828] hover:bg-[#FFEBEE]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                        <Link
                          href={`${config.basePath}/applicants?status=interview`}
                          className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FE]"
                          style={{ color: colors.navy }}
                        >
                          Applicant
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      ) : null}

      <ScheduleInterviewModal
        open={scheduleOpen}
        onClose={() => {
          setScheduleOpen(false);
          setSlotStartsAt(null);
        }}
        candidates={candidates}
        initialStartsAt={slotStartsAt}
        onScheduled={(message) => {
          setInfo(message);
          setSlotStartsAt(null);
          void load();
        }}
      />
    </div>
  );
}
