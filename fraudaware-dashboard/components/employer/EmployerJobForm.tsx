'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@/lib/api/authTypes';
import type { CreateJobPayload, JobStatus } from '@/lib/api/jobApi';
import { colors } from '@/lib/theme/colors';

const MODES = ['On-Site', 'Remote', 'Hybrid'] as const;
const TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'] as const;
const STATUSES: JobStatus[] = ['draft', 'active', 'closed', 'pending_review'];

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
    posterImage: '',
  };
}

type Props = {
  isCompany: boolean;
  user: AuthUser | null;
  companyNameOverride?: string;
  initial: CreateJobPayload;
  existingLogoUrl?: string | null;
  existingPosterUrl?: string | null;
  submitLabel: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (
    payload: CreateJobPayload,
    logoFile: File | null,
    posterFile: File | null
  ) => Promise<void>;
};

export default function EmployerJobForm({
  isCompany,
  user,
  companyNameOverride,
  initial,
  existingLogoUrl,
  existingPosterUrl,
  submitLabel,
  saving,
  onCancel,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<CreateJobPayload>(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(existingLogoUrl ?? null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(
    existingPosterUrl || initial.posterImage || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setForm(initial);
      setLogoFile(null);
      setLogoPreview(existingLogoUrl ?? null);
      setPosterFile(null);
      setPosterPreview(existingPosterUrl || initial.posterImage || null);
    });
    return () => {
      cancelled = true;
    };
  }, [initial, existingLogoUrl, existingPosterUrl]);

  useEffect(() => {
    if (!logoFile) return;
    const url = URL.createObjectURL(logoFile);
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLogoPreview(url);
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [logoFile]);

  useEffect(() => {
    if (!posterFile) return;
    const url = URL.createObjectURL(posterFile);
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setPosterPreview(url);
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [posterFile]);

  const companyLocked = Boolean(companyNameOverride) || isCompany;
  const companyName = companyLocked
    ? companyNameOverride || user?.company?.name || form.companyName || ''
    : form.companyName || '';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const payload: CreateJobPayload = {
      ...form,
      companyName,
      description: form.description.trim(),
      requirements: form.requirements?.trim() || '',
      skills: form.skills?.trim() || '',
      benefits: form.benefits?.trim() || '',
      about: form.about?.trim() || '',
      posterImage: form.posterImage?.trim() || '',
    };

    await onSubmit(payload, logoFile, posterFile);
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
          required={!companyLocked}
          disabled={companyLocked}
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

      <div>
        <p
          className="mb-2 text-sm font-medium"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          Job poster
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex h-36 w-full max-w-sm items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EE] bg-[#F7F8FE]">
            {posterPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span
                className="text-xs font-semibold"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Poster
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => posterInputRef.current?.click()}
                className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-semibold"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Upload poster
              </button>
              {posterFile || posterPreview ? (
                <button
                  type="button"
                  onClick={() => {
                    setPosterFile(null);
                    setPosterPreview(null);
                    setForm((prev) => ({ ...prev, posterImage: '' }));
                    if (posterInputRef.current) posterInputRef.current.value = '';
                  }}
                  className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-semibold text-[#C62828]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p
              className="max-w-sm text-xs leading-relaxed"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Artwork for this job listing (banner or flyer). This is not your
              profile photo or company logo.
            </p>
          </div>
          <input
            ref={posterInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPosterFile(file);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
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
