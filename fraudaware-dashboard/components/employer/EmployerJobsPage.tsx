'use client';

import { FormEvent, useEffect, useState } from 'react';
import EmployerShell from '@/components/employer/EmployerShell';
import {
  createJob,
  deleteJob,
  listMyJobs,
  type CreateJobPayload,
  type JobSummary,
} from '@/lib/api/jobApi';
import type { AuthUser } from '@/lib/api/authTypes';
import type { PortalType } from '@/lib/auth/portalConfig';
import { getStoredToken, getStoredUser } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const MODES = ['On-Site', 'Remote', 'Hybrid'] as const;
const TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'] as const;

const emptyForm = (companyName = ''): CreateJobPayload => ({
  title: '',
  companyName,
  location: '',
  mode: 'On-Site',
  type: 'Full-Time',
  salaryMin: 0,
  salaryMax: 0,
  salaryCurrency: 'LKR',
  description: '',
  requirements: '',
  skills: '',
  status: 'active',
});

export default function EmployerJobsPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const isCompany = portal === 'company';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [form, setForm] = useState<CreateJobPayload>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const reload = async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const items = await listMyJobs(token);
      setJobs(items);
      setError(null);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not load jobs.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setForm(emptyForm(stored?.company?.name || ''));
    void reload();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const token = getStoredToken();
    if (!token) return;

    setSaving(true);
    setError(null);
    try {
      const payload: CreateJobPayload = {
        ...form,
        companyName: isCompany
          ? user?.company?.name || form.companyName
          : form.companyName,
        description: form.description.trim(),
      };
      await createJob(token, payload);
      setShowForm(false);
      setForm(emptyForm(user?.company?.name || ''));
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not create job.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    const token = getStoredToken();
    if (!token) return;
    if (!window.confirm('Delete this job posting?')) return;

    try {
      await deleteJob(token, jobId);
      await reload();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not delete job.'
      );
    }
  };

  return (
    <EmployerShell portal={portal}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2
                className="text-xl font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Jobs
              </h2>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                {isCompany
                  ? 'Post openings for your company. Company name is locked to your profile.'
                  : 'Post jobs for any employer and manage your listings.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {showForm ? 'Close form' : 'Post a job'}
            </button>
          </div>

          {showForm ? (
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
              <TextField
                label="Job title"
                value={form.title}
                onChange={(title) => setForm((prev) => ({ ...prev, title }))}
                required
              />
              <TextField
                label="Company name"
                value={
                  isCompany ? user?.company?.name || form.companyName || '' : form.companyName || ''
                }
                onChange={(companyName) => setForm((prev) => ({ ...prev, companyName }))}
                required={!isCompany}
                disabled={isCompany}
              />
              <TextField
                label="Location"
                value={form.location}
                onChange={(location) => setForm((prev) => ({ ...prev, location }))}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Mode"
                  value={form.mode}
                  options={MODES}
                  onChange={(mode) =>
                    setForm((prev) => ({
                      ...prev,
                      mode: mode as CreateJobPayload['mode'],
                    }))
                  }
                />
                <SelectField
                  label="Type"
                  value={form.type}
                  options={TYPES}
                  onChange={(type) =>
                    setForm((prev) => ({
                      ...prev,
                      type: type as CreateJobPayload['type'],
                    }))
                  }
                />
              </div>
              <TextField
                label="Salary min"
                type="number"
                value={String(form.salaryMin)}
                onChange={(salaryMin) =>
                  setForm((prev) => ({ ...prev, salaryMin: Number(salaryMin) || 0 }))
                }
                required
              />
              <TextField
                label="Salary max"
                type="number"
                value={String(form.salaryMax)}
                onChange={(salaryMax) =>
                  setForm((prev) => ({ ...prev, salaryMax: Number(salaryMax) || 0 }))
                }
                required
              />
              <div className="md:col-span-2">
                <label
                  className="mb-2 block text-sm font-medium"
                  style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                >
                  Description
                </label>
                <textarea
                  required
                  minLength={15}
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#202871] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {saving ? 'Publishing...' : 'Publish job'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-sm">
          {loading ? (
            <p
              className="px-6 py-10 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Loading jobs...
            </p>
          ) : error ? (
            <p
              className="px-6 py-10 text-center text-sm text-red-600"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {error}
            </p>
          ) : jobs.length === 0 ? (
            <p
              className="px-6 py-10 text-center text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              No jobs posted yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#EEF0F8]">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6"
                >
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                    >
                      {job.title}
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                    >
                      {job.companyName} · {job.status} · {job.applicants} applicants
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(job.id)}
                    className="rounded-xl border border-[#E5E7EE] px-3 py-2 text-xs font-semibold text-[#C62828]"
                    style={{ fontFamily: 'var(--font-poppins)' }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </EmployerShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  disabled,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-[#E5E7EE] px-3 text-sm outline-none focus:border-[#202871] disabled:bg-[#F7F8FE]"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-[#E5E7EE] bg-white px-3 text-sm outline-none focus:border-[#202871]"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
