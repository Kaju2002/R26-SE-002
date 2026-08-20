'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@/lib/api/authTypes';
import type { CreateJobPayload, JobStatus } from '@/lib/api/jobApi';
import { colors } from '@/lib/theme/colors';

const MODES = ['On-Site', 'Remote', 'Hybrid'] as const;
const TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship'] as const;
const STATUSES: JobStatus[] = ['draft', 'active', 'closed', 'pending_review'];

const inputClass =
  'h-11 w-full rounded-xl border border-[#E5E7EE] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#9CA3AF] hover:border-[#C9D2E0] focus:border-[#202871] focus:ring-2 focus:ring-[#202871]/12 disabled:cursor-not-allowed disabled:bg-[#F7F8FE]';

const textareaClass =
  'w-full rounded-xl border border-[#E5E7EE] bg-white px-3.5 py-2.5 text-sm leading-relaxed outline-none transition placeholder:text-[#9CA3AF] hover:border-[#C9D2E0] focus:border-[#202871] focus:ring-2 focus:ring-[#202871]/12';

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
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
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
        <div className="flex flex-wrap items-start gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#C9D2E0] bg-[#F7F8FE] transition hover:border-[#202871] hover:bg-[#EEF0F8]"
            aria-label="Upload company logo"
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 px-2">
                <FileUploadIcon className="h-7 w-7 text-[#202871]" />
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  Add file
                </span>
              </span>
            )}
          </button>
          <div className="min-w-0 space-y-2 pt-1">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-[#202871] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2160]"
                style={{ fontFamily: 'var(--font-poppins)' }}
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
                  className="rounded-xl border border-[#E5E7EE] bg-white px-4 py-2 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFEBEE]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p
              className="max-w-xs text-xs leading-relaxed"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              PNG or JPG. Square logo works best.
            </p>
            {isCompany && user?.company?.logo ? (
              <p
                className="max-w-xs text-xs leading-relaxed"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                Company accounts may also inherit the profile logo from branding settings.
              </p>
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
      </div>

      <div>
        <p
          className="mb-2 text-sm font-medium"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          Job poster
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => posterInputRef.current?.click()}
            className="group relative flex h-36 w-full max-w-sm shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#C9D2E0] bg-[#F7F8FE] transition hover:border-[#202871] hover:bg-[#EEF0F8]"
            aria-label="Upload job poster"
          >
            {posterPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 px-4">
                <FileUploadIcon className="h-8 w-8 text-[#202871]" />
                <span
                  className="text-xs font-semibold"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  Choose poster file
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  PNG, JPG · banner or flyer
                </span>
              </span>
            )}
          </button>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => posterInputRef.current?.click()}
                className="rounded-xl bg-[#202871] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2160]"
                style={{ fontFamily: 'var(--font-poppins)' }}
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
                  className="rounded-xl border border-[#E5E7EE] bg-white px-4 py-2 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFEBEE]"
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
              Artwork for this job listing. This is not your profile photo or company logo.
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

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#202871] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2160] disabled:opacity-70"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-[#E5E7EE] bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-70"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function FileUploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
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
        className="mb-1.5 block text-sm font-medium"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
        {required ? <span className="ml-0.5 text-[#C62828]">*</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        className={inputClass}
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
        className="mb-1.5 block text-sm font-medium"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, ' ')}
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
        className="mb-1.5 block text-sm font-medium"
        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
        {required ? <span className="ml-0.5 text-[#C62828]">*</span> : null}
      </label>
      <textarea
        required={required}
        minLength={minLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={textareaClass}
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      />
      {hint ? (
        <p
          className="mt-1.5 text-xs"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
