'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildJobRiskText, predictFakeJobFromText } from '@/lib/api/fakeJobApi';
import {
  descriptionToText,
  getJobById,
  listJobApplications,
  updateJob,
  type JobApplication,
  type JobDetail,
  type JobStatus,
} from '@/lib/api/jobApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

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

function statusStyles(status: string): { color: string; background: string } {
  if (status === 'active') return { color: '#2E7D32', background: '#E8F5E9' };
  if (status === 'draft') return { color: '#EF6C00', background: '#FFF3E0' };
  return { color: '#C62828', background: '#FFEBEE' };
}

export default function EmployerJobDetailPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const basePath = portalConfigs[portal].basePath;
  const jobId = params.jobId;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }
    if (!jobId) {
      setError('Missing job id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [jobResult, apps] = await Promise.all([
        getJobById(token, jobId),
        listJobApplications(token, jobId).catch(() => []),
      ]);
      setJob(jobResult);
      setApplications(apps);
      setError(null);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not load job.'
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const performance = useMemo(() => {
    const total = applications.length || job?.applicants || 0;
    const pending = applications.filter((item) => item.status === 'pending').length;
    const accepted = applications.filter((item) => item.status === 'accepted').length;
    const rejected = applications.filter((item) => item.status === 'rejected').length;
    const conversion =
      total > 0 ? Math.round(((accepted + rejected) / total) * 100) : 0;
    return { total, pending, accepted, rejected, conversion };
  }, [applications, job?.applicants]);

  const setStatus = async (status: JobStatus) => {
    const token = getStoredToken();
    if (!token || !job) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    if (status === 'active') {
      try {
        const text = buildJobRiskText({
          title: job.title,
          companyName: job.companyName,
          location: job.location || '',
          description: descriptionToText(job.description) || job.title,
          requirements: (job.requirements || []).join('\n'),
          skills: (job.skills || []).join(', '),
        });
        const risk = await predictFakeJobFromText(text);
        const prediction = risk.prediction.toLowerCase();
        if (prediction === 'fake' || prediction === 'suspicious') {
          const proceed = window.confirm(
            `${risk.message}\n\nPublish “${job.title}” anyway?`
          );
          if (!proceed) {
            setBusy(false);
            return;
          }
        }
      } catch (requestError: unknown) {
        const proceed = window.confirm(
          `${
            requestError instanceof Error
              ? requestError.message
              : 'Fake-job check failed.'
          }\n\nPublish without a completed risk check?`
        );
        if (!proceed) {
          setBusy(false);
          return;
        }
      }
    }

    try {
      const updated = await updateJob(token, job.id, { status });
      setJob(updated);
      setMessage(
        status === 'active'
          ? 'Listing republished as active.'
          : status === 'closed'
            ? 'Listing closed.'
            : 'Listing moved to draft.'
      );
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update listing status.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push(`${basePath}/jobs`)}
            className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            ← Back to jobs
          </button>
          {job ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`${basePath}/applicants`}
                className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                View applicants
              </Link>
              {job.status === 'closed' || job.status === 'draft' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus('active')}
                  className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {job.status === 'closed' ? 'Republish' : 'Publish'}
                </button>
              ) : null}
              {job.status === 'active' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setStatus('closed')}
                  className="rounded-xl border border-[#FFCDD2] px-4 py-2 text-sm font-semibold text-[#C62828] disabled:opacity-70"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Close listing
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {message ? (
          <div
            className="rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-[#EEF0F8] bg-white px-6 py-16 text-center shadow-sm">
            <p
              className="text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Loading job details...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#FFCDD2] bg-[#FFEBEE] px-6 py-10 text-center shadow-sm">
            <p
              className="text-sm text-[#C62828]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </p>
          </div>
        ) : job ? (
          <>
            <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF0F8]">
                  {job.companyLogoUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.companyLogoUri}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-sm font-bold"
                      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                    >
                      {(job.companyName || 'J').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1
                      className="text-2xl font-semibold"
                      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                    >
                      {job.title}
                    </h1>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize"
                      style={{
                        ...statusStyles(job.status),
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                  >
                    {job.companyName}
                    {job.location ? ` · ${job.location}` : ''}
                    {job.mode ? ` · ${job.mode}` : ''}
                    {job.type ? ` · ${job.type}` : ''}
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    Posted {formatDate(job.postedAt)}
                    {job.endsAt ? ` · Closes ${formatDate(job.endsAt)}` : ''}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Applicants" value={String(performance.total)} />
                <StatCard label="Pending" value={String(performance.pending)} />
                <StatCard label="Accepted" value={String(performance.accepted)} />
                <StatCard
                  label="Reviewed rate"
                  value={`${performance.conversion}%`}
                />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard title="Role overview">
                <p
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                  style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                >
                  {descriptionToText(job.description) || 'No description provided.'}
                </p>
                {job.about ? (
                  <div className="mt-4">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{
                        color: colors.muted,
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      About
                    </h4>
                    <p
                      className="mt-2 whitespace-pre-wrap text-sm"
                      style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                    >
                      {job.about}
                    </p>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard title="Compensation & requirements">
                <dl className="space-y-3 text-sm">
                  <Detail
                    label="Salary"
                    value={
                      job.salaryMin != null && job.salaryMax != null
                        ? `${job.salaryCurrency || ''} ${job.salaryMin} – ${job.salaryMax}`.trim()
                        : '—'
                    }
                  />
                  <Detail label="Job level" value={job.jobLevel || '—'} />
                  <Detail label="Education" value={job.education || '—'} />
                  <Detail label="Experience" value={job.experience || '—'} />
                </dl>
                {job.requirements?.length ? (
                  <BulletList title="Requirements" items={job.requirements} />
                ) : null}
                {job.skills?.length ? (
                  <div className="mt-4">
                    <h4
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{
                        color: colors.muted,
                        fontFamily: 'var(--font-poppins)',
                      }}
                    >
                      Skills
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {job.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-[#EEF0F8] px-3 py-1 text-xs font-medium"
                          style={{
                            color: colors.navy,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {job.benefits?.length ? (
                  <BulletList title="Benefits" items={job.benefits} />
                ) : null}
              </SectionCard>
            </div>

            <SectionCard title="Recent applicants">
              {applications.length === 0 ? (
                <p
                  className="text-sm"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  No applications yet for this listing.
                </p>
              ) : (
                <ul className="divide-y divide-[#EEF0F8]">
                  {applications.slice(0, 8).map((application) => (
                    <li
                      key={application.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p
                          className="text-sm font-semibold"
                          style={{
                            color: colors.navy,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {application.fullName}
                        </p>
                        <p
                          className="text-xs"
                          style={{
                            color: colors.muted,
                            fontFamily: 'var(--font-poppins)',
                          }}
                        >
                          {application.email} · {formatDate(application.appliedAt)}
                        </p>
                      </div>
                      <span
                        className="rounded-full bg-[#F7F8FE] px-2.5 py-1 text-xs font-semibold capitalize"
                        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                      >
                        {application.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#EEF0F8] bg-[#F7F8FE] px-4 py-3">
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-xl font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm">
      <h2
        className="text-base font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </dt>
      <dd
        className="text-right text-sm"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </dd>
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h4
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {title}
      </h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: colors.body }}>
        {items.map((item) => (
          <li key={item} style={{ fontFamily: 'var(--font-poppins)' }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
