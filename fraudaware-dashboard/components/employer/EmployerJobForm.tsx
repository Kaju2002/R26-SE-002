'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUser } from '@/lib/api/authTypes';
import {
  buildJobRiskText,
  predictFakeJobFromText,
  type FakeJobPrediction,
} from '@/lib/api/fakeJobApi';
import type { CreateJobPayload, JobStatus } from '@/lib/api/jobApi';
import { colors } from '@/lib/theme/colors';

const MODES = ['On-Site', 'Remote', 'Hybrid'] as const;
const TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'] as const;
const STATUSES: JobStatus[] = ['draft', 'active', 'closed'];

export function emptyJobForm(companyName = ''): CreateJobPayload {
  return {
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
    benefits: '',
    about: '',
    jobLevel: '',
    education: '',
    experience: '',
    status: 'draft',
  };
}

type Props = {
  isCompany: boolean;
  user: AuthUser | null;
  initial: CreateJobPayload;
  existingLogoUrl?: string | null;
  submitLabel: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateJobPayload, logoFile: File | null) => Promise<void>;
};

export default function EmployerJobForm({
  isCompany,
  user,
  initial,
  existingLogoUrl,
  submitLabel,
  saving,
  onCancel,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<CreateJobPayload>(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(existingLogoUrl ?? null);
  const [risk, setRisk] = useState<FakeJobPrediction | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [checkingRisk, setCheckingRisk] = useState(false);
  const [riskBypass, setRiskBypass] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(initial);
    setLogoFile(null);
    setLogoPreview(existingLogoUrl ?? null);
    setRisk(null);
    setRiskError(null);
    setRiskBypass(false);
    setLocalError(null);
  }, [initial, existingLogoUrl]);

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const companyName = isCompany
    ? user?.company?.name || form.companyName || ''
    : form.companyName || '';

  const riskTone = useMemo(() => {
    const prediction = risk?.prediction?.toLowerCase();
    if (prediction === 'fake') {
      return { color: '#C62828', background: '#FFEBEE', label: 'High risk' };
    }
    if (prediction === 'suspicious') {
      return { color: '#EF6C00', background: '#FFF3E0', label: 'Medium risk' };
    }
    if (prediction === 'legitimate') {
      return { color: '#2E7D32', background: '#E8F5E9', label: 'Low risk' };
    }
    return null;
  }, [risk]);

  const runRiskCheck = async (): Promise<FakeJobPrediction | null> => {
    setCheckingRisk(true);
    setRiskError(null);
    try {
      const text = buildJobRiskText({
        title: form.title,
        companyName,
        location: form.location,
        description: form.description,
        requirements: form.requirements,
        skills: form.skills,
      });
      const result = await predictFakeJobFromText(text);
      setRisk(result);
      setRiskBypass(false);
      return result;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Could not run fake-job risk check.';
      setRiskError(message);
      setRisk(null);
      return null;
    } finally {
      setCheckingRisk(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const payload: CreateJobPayload = {
      ...form,
      companyName,
      description: form.description.trim(),
      requirements: form.requirements?.trim() || '',
      skills: form.skills?.trim() || '',
      benefits: form.benefits?.trim() || '',
      about: form.about?.trim() || '',
    };

    const publishing = payload.status === 'active';
    if (publishing) {
      const result = risk ?? (await runRiskCheck());
      if (!result) {
        setLocalError(
          'Fake-job risk check is required before publishing. Save as draft, or retry the check.'
        );
        return;
      }

      const prediction = result.prediction.toLowerCase();
      if (prediction === 'fake' && !riskBypass) {
        setLocalError(
          'This posting looks fake. Save as draft, revise the copy, or confirm publish anyway.'
        );
        return;
      }
      if (prediction === 'suspicious' && !riskBypass) {
        setLocalError(
          'This posting looks suspicious. Review the risk result, then confirm publish anyway if you still want to proceed.'
        );
        return;
      }
    }

    await onSubmit(payload, logoFile);
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Job title"
          value={form.title}
          onChange={(title) => setForm((prev) => ({ ...prev, title }))}
          required
        />
        <TextField
          label="Company name"
          value={companyName}
          onChange={(next) => setForm((prev) => ({ ...prev, companyName: next }))}
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
              setForm((prev) => ({ ...prev, mode: mode as CreateJobPayload['mode'] }))
            }
          />
          <SelectField
            label="Type"
            value={form.type}
            options={TYPES}
            onChange={(type) =>
              setForm((prev) => ({ ...prev, type: type as CreateJobPayload['type'] }))
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
        <TextField
          label="Currency"
          value={form.salaryCurrency || 'LKR'}
          onChange={(salaryCurrency) => setForm((prev) => ({ ...prev, salaryCurrency }))}
        />
        <SelectField
          label="Status"
          value={form.status || 'draft'}
          options={STATUSES}
          onChange={(status) =>
            setForm((prev) => ({ ...prev, status: status as JobStatus }))
          }
        />
        <TextField
          label="Job level"
          value={form.jobLevel || ''}
          onChange={(jobLevel) => setForm((prev) => ({ ...prev, jobLevel }))}
        />
        <TextField
          label="Education"
          value={form.education || ''}
          onChange={(education) => setForm((prev) => ({ ...prev, education }))}
        />
        <TextField
          label="Experience"
          value={form.experience || ''}
          onChange={(experience) => setForm((prev) => ({ ...prev, experience }))}
        />
      </div>

      <TextAreaField
        label="Description"
        value={form.description}
        onChange={(description) => setForm((prev) => ({ ...prev, description }))}
        required
        minLength={15}
        rows={5}
        hint="One paragraph or one bullet per line."
      />
      <TextAreaField
        label="Requirements"
        value={form.requirements || ''}
        onChange={(requirements) => setForm((prev) => ({ ...prev, requirements }))}
        rows={4}
        hint="One requirement per line."
      />
      <TextAreaField
        label="Skills"
        value={form.skills || ''}
        onChange={(skills) => setForm((prev) => ({ ...prev, skills }))}
        rows={2}
        hint="Comma-separated, e.g. React, TypeScript, SQL"
      />
      <TextAreaField
        label="Benefits"
        value={form.benefits || ''}
        onChange={(benefits) => setForm((prev) => ({ ...prev, benefits }))}
        rows={3}
        hint="One benefit per line."
      />
      <TextAreaField
        label="About the role / company"
        value={form.about || ''}
        onChange={(about) => setForm((prev) => ({ ...prev, about }))}
        rows={3}
      />

      <div>
        <p
          className="mb-2 text-sm font-medium"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          Company logo / branding
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EE] bg-[#F7F8FE]">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="text-xs font-semibold"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Logo
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Upload logo
            </button>
            {logoFile || logoPreview ? (
              <button
                type="button"
                onClick={() => {
                  setLogoFile(null);
                  setLogoPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-semibold text-[#C62828]"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                Remove
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setLogoFile(file);
            }}
          />
        </div>
        {isCompany && user?.company?.logo ? (
          <p
            className="mt-2 text-xs"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Company accounts also inherit the profile logo from branding settings when
            available.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Fake-job risk check
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
            >
              Required before publishing as active. Draft saves skip this gate.
            </p>
          </div>
          <button
            type="button"
            disabled={checkingRisk || saving}
            onClick={() => void runRiskCheck()}
            className="rounded-xl border border-[#E5E7EE] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-70"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {checkingRisk ? 'Checking…' : 'Run risk check'}
          </button>
        </div>

        {risk && riskTone ? (
          <div
            className="mt-3 rounded-xl px-3 py-3 text-sm"
            style={{
              backgroundColor: riskTone.background,
              color: riskTone.color,
              fontFamily: 'var(--font-poppins)',
            }}
          >
            <p className="font-semibold">
              {riskTone.label} · {risk.prediction} ·{' '}
              {Math.round(risk.fake_probability * 100)}% fake probability
            </p>
            <p className="mt-1 text-xs opacity-90">{risk.message}</p>
            {(risk.prediction.toLowerCase() === 'fake' ||
              risk.prediction.toLowerCase() === 'suspicious') && (
              <label className="mt-3 flex items-start gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={riskBypass}
                  onChange={(event) => setRiskBypass(event.target.checked)}
                  className="mt-0.5"
                />
                I reviewed this result and still want to publish as active
              </label>
            )}
          </div>
        ) : null}

        {riskError ? (
          <p
            className="mt-3 text-sm text-[#C62828]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {riskError}
          </p>
        ) : null}
      </div>

      {localError ? (
        <p className="text-sm text-[#C62828]" style={{ fontFamily: 'var(--font-poppins)' }}>
          {localError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || checkingRisk}
          className="rounded-xl bg-[#202871] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-[#E5E7EE] px-5 py-2.5 text-sm font-semibold disabled:opacity-70"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Cancel
        </button>
      </div>
    </form>
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

function TextAreaField({
  label,
  value,
  onChange,
  required,
  minLength,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  rows: number;
  hint?: string;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </label>
      <textarea
        required={required}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      />
      {hint ? (
        <p
          className="mt-1 text-xs"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
