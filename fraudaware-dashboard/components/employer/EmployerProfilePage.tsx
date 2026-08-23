'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useEmployerWorkspace } from '@/components/employer/EmployerWorkspaceContext';
import { getCurrentUser } from '@/lib/api/authApi';
import type { AuthUser } from '@/lib/api/authTypes';
import {
  disconnectEmail,
  getEmailConnectUrl,
  getEmailStatus,
  type EmailStatus,
} from '@/lib/api/emailApi';
import { listMyJobs } from '@/lib/api/jobApi';
import {
  updateAvatar,
  updateBasicProfile,
  updateCompanyLogo,
} from '@/lib/api/profileApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken, getStoredUser, updateStoredUser } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type ProfileTab = 'profile' | 'company' | 'email';
type EditMode = 'none' | 'account' | 'company';

type AccountForm = {
  fullName: string;
  headline: string;
  location: string;
};

type CompanyForm = {
  name: string;
  website: string;
  industry: string;
  address: string;
  registrationNumber: string;
  description: string;
};

function initialsFromName(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return (name || 'U').slice(0, 2).toUpperCase();
}

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

function titleCase(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function accountFormFromUser(user: AuthUser | null): AccountForm {
  return {
    fullName: user?.fullName || '',
    headline: user?.headline || user?.role || '',
    location: user?.location || '',
  };
}

function companyFormFromUser(user: AuthUser | null): CompanyForm {
  return {
    name: user?.company?.name || '',
    website: user?.company?.website || '',
    industry: user?.company?.industry || '',
    address: user?.company?.address || '',
    registrationNumber: user?.company?.registrationNumber || '',
    description: user?.company?.description || '',
  };
}

export default function EmployerProfilePage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const basePath = portalConfigs[portal].basePath;
  const isCompany = portal === 'company';
  const { activeWorkspace, refreshWorkspaces } = useEmployerWorkspace();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('profile');
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [accountForm, setAccountForm] = useState<AccountForm>(accountFormFromUser(null));
  const [companyForm, setCompanyForm] = useState<CompanyForm>(companyFormFromUser(null));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [jobCount, setJobCount] = useState(0);
  const [applicantCount, setApplicantCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setAccountForm(accountFormFromUser(stored));
    setCompanyForm(companyFormFromUser(stored));

    const token = getStoredToken();
    if (!token) return;

    let cancelled = false;
    getCurrentUser(token)
      .then((response) => {
        if (cancelled) return;
        setUser(response.user);
        updateStoredUser(response.user);
        setAccountForm(accountFormFromUser(response.user));
        setCompanyForm(companyFormFromUser(response.user));
      })
      .catch(() => {
        /* keep stored session snapshot */
      });

    getEmailStatus(token)
      .then((status) => {
        if (!cancelled) setEmailStatus(status);
      })
      .catch(() => {
        if (!cancelled) {
          setEmailStatus({ connected: false, email: null, connectedAt: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !activeWorkspace?.id) {
      setJobCount(0);
      setApplicantCount(0);
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);
    listMyJobs(token, { limit: 50, workspaceId: activeWorkspace.id })
      .then((result) => {
        if (cancelled) return;
        setJobCount(result.pagination?.total ?? result.jobs.length);
        setApplicantCount(
          result.jobs.reduce((sum, job) => sum + (job.applicants || 0), 0)
        );
      })
      .catch(() => {
        if (cancelled) return;
        setJobCount(0);
        setApplicantCount(0);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [avatarPreview, logoPreview]);

  const displayName = user?.fullName || 'User';
  const roleLine =
    user?.headline ||
    user?.role ||
    (isCompany ? 'Company account' : 'Recruiter');
  const companyName =
    activeWorkspace?.name || user?.company?.name || (isCompany ? 'Company' : '—');
  const avatarSrc =
    avatarPreview || user?.avatar || activeWorkspace?.logo || user?.company?.logo || '';
  const companyLogoSrc =
    logoPreview || user?.company?.logo || activeWorkspace?.logo || '';
  const mailboxOn = Boolean(emailStatus?.connected);
  const accountActive =
    !user?.accountStatus || user.accountStatus.toLowerCase() === 'active';

  const tabs = useMemo(
    () =>
      [
        { id: 'profile' as const, label: 'Account', icon: 'user' },
        {
          id: 'company' as const,
          label: isCompany ? 'Company' : 'Workspace',
          icon: 'building',
        },
        { id: 'email' as const, label: 'Mailbox', icon: 'mail' },
      ] as const,
    [isCompany]
  );

  const refreshUser = async (token: string) => {
    const response = await getCurrentUser(token);
    setUser(response.user);
    updateStoredUser(response.user);
    setAccountForm(accountFormFromUser(response.user));
    setCompanyForm(companyFormFromUser(response.user));
    return response.user;
  };

  const clearFilePreviews = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setLogoPreview(null);
    setLogoFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const startEditAccount = () => {
    setError(null);
    setMessage(null);
    setEditMode('account');
    setTab('profile');
    setAccountForm(accountFormFromUser(user));
    clearFilePreviews();
  };

  const startEditCompany = () => {
    setError(null);
    setMessage(null);
    setEditMode('company');
    setTab('company');
    setCompanyForm(companyFormFromUser(user));
    clearFilePreviews();
  };

  const cancelEdit = () => {
    setEditMode('none');
    setAccountForm(accountFormFromUser(user));
    setCompanyForm(companyFormFromUser(user));
    clearFilePreviews();
    setError(null);
  };

  const onAvatarPicked = (file: File | null) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (!file) {
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onLogoPicked = (file: File | null) => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const saveAccount = async () => {
    const token = getStoredToken();
    if (!token) return;

    const fullName = accountForm.fullName.trim();
    if (fullName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateBasicProfile(token, {
        fullName,
        headline: accountForm.headline.trim(),
        role: accountForm.headline.trim(),
        location: accountForm.location.trim(),
      });
      if (avatarFile) {
        await updateAvatar(token, avatarFile);
      }
      await refreshUser(token);
      clearFilePreviews();
      setEditMode('none');
      setMessage('Profile updated.');
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update profile.'
      );
    } finally {
      setBusy(false);
    }
  };

  const saveCompany = async () => {
    const token = getStoredToken();
    if (!token) return;

    const name = companyForm.name.trim();
    if (!name) {
      setError('Company name is required.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Prefer form values; if a field is left blank, keep the existing profile value
      // so a partial edit does not wipe website / industry / etc.
      await updateBasicProfile(token, {
        company: {
          name,
          website:
            companyForm.website.trim() || user?.company?.website || null,
          industry:
            companyForm.industry.trim() || user?.company?.industry || null,
          address:
            companyForm.address.trim() || user?.company?.address || null,
          registrationNumber:
            companyForm.registrationNumber.trim() ||
            user?.company?.registrationNumber ||
            null,
          description:
            companyForm.description.trim() ||
            user?.company?.description ||
            null,
        },
      });
      if (logoFile) {
        await updateCompanyLogo(token, logoFile);
      }
      await refreshUser(token);
      // Sync workspace.logo from company profile so sidebar brand updates.
      await refreshWorkspaces().catch(() => undefined);
      clearFilePreviews();
      setEditMode('none');
      setMessage(isCompany ? 'Company details updated.' : 'Workspace company details updated.');
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not update company details.'
      );
    } finally {
      setBusy(false);
    }
  };

  const connect = async (provider: 'google' | 'microsoft') => {
    const token = getStoredToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const returnTo = `${window.location.origin}${basePath}/email/callback`;
      const authUrl = await getEmailConnectUrl(token, provider, returnTo);
      window.location.href = authUrl;
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not start mailbox connection.'
      );
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const token = getStoredToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectEmail(token);
      setEmailStatus({ connected: false, email: null, connectedAt: null });
      setMessage('Mailbox disconnected.');
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not disconnect mailbox.'
      );
    } finally {
      setBusy(false);
    }
  };

  const selectTab = (next: ProfileTab) => {
    if (editMode !== 'none' && next !== (editMode === 'account' ? 'profile' : 'company')) {
      cancelEdit();
    }
    setTab(next);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-semibold tracking-tight"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Profile
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Your account, {isCompany ? 'company' : 'workspace'}, and hiring mailbox
          </p>
        </div>
        {editMode === 'none' ? (
          <button
            type="button"
            onClick={startEditAccount}
            className="rounded-lg bg-[#202871] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a2160]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            Edit profile
          </button>
        ) : null}
      </header>

      {/* Identity */}
      <section className="overflow-hidden rounded-2xl border border-[#E8EAF4] bg-white shadow-[0_1px_2px_rgba(32,40,113,0.04)]">
        <div
          className="relative h-20 w-full md:h-24"
          style={{
            background:
              'linear-gradient(135deg, #202871 0%, #3A4BA8 50%, #6B7BD4 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 90% 20%, rgba(255,255,255,0.35) 0%, transparent 42%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.12) 0%, transparent 38%)',
            }}
          />
          <p
            className="absolute bottom-3 right-4 text-[11px] font-medium text-white/70 md:right-6"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {isCompany ? 'Company portal' : 'Recruiter portal'}
          </p>
        </div>

        <div className="relative px-5 pb-5 md:px-6 md:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <div className="flex min-w-0 items-start gap-4">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt=""
                  className="-mt-8 h-[72px] w-[72px] shrink-0 rounded-2xl border-[3px] border-white object-cover shadow-sm md:-mt-9"
                  style={{ backgroundColor: '#F4F5FB' }}
                />
              ) : (
                <div className="-mt-8 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border-[3px] border-white bg-[#EEF0F8] shadow-sm md:-mt-9">
                  <span
                    className="text-lg font-semibold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    {initialsFromName(displayName)}
                  </span>
                </div>
              )}

              <div className="min-w-0 pt-2 sm:pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="truncate text-lg font-semibold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    {displayName}
                  </h3>
                  <StatusPill
                    tone={accountActive ? 'success' : 'neutral'}
                    label={titleCase(user?.accountStatus || 'Active')}
                  />
                </div>
                <p
                  className="mt-0.5 truncate text-sm"
                  style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                >
                  {roleLine}
                  {companyName &&
                  companyName !== '—' &&
                  companyName.toLowerCase() !== (roleLine || '').toLowerCase()
                    ? ` · ${companyName}`
                    : ''}
                </p>
                {user?.email ? (
                  <p
                    className="mt-1 truncate text-sm"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    {user.email}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 sm:justify-end sm:pt-3">
              <Link
                href={`${basePath}/jobs`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EE] bg-white px-3.5 py-2 text-sm font-medium transition hover:border-[#C8CDE8] hover:bg-[#F7F8FE]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Jobs
                <ChevronRight />
              </Link>
              <Link
                href={`${basePath}/applicants`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EE] bg-white px-3.5 py-2 text-sm font-medium transition hover:border-[#C8CDE8] hover:bg-[#F7F8FE]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Applicants
                <ChevronRight />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[#E8EAF4] bg-[#E8EAF4] sm:grid-cols-3">
            <GlanceStat
              label="Open jobs"
              value={statsLoading ? '…' : String(jobCount)}
              href={`${basePath}/jobs`}
              hint="View job list"
            />
            <GlanceStat
              label="Applicants"
              value={statsLoading ? '…' : String(applicantCount)}
              href={`${basePath}/applicants`}
              hint="Review pipeline"
            />
            <GlanceStat
              label="Mailbox"
              value={mailboxOn ? 'Connected' : 'Not connected'}
              hint={
                mailboxOn
                  ? emailStatus?.email || 'Ready to send'
                  : 'Connect Gmail or Outlook'
              }
              onClick={() => selectTab('email')}
              tone={mailboxOn ? 'success' : 'warn'}
            />
          </div>
        </div>
      </section>

          {message ? (
        <div
          className="rounded-xl border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#2E7D32]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
        </div>
      ) : null}
      {error ? (
        <div
          className="rounded-xl border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#C62828]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#E8EAF4] bg-white shadow-[0_1px_2px_rgba(32,40,113,0.04)]">
        <div
          className="flex gap-1 border-b border-[#E8EAF4] px-2 pt-1 md:px-4"
          role="tablist"
          aria-label="Profile sections"
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(item.id)}
                className={`relative flex shrink-0 items-center gap-2 px-3.5 py-3.5 text-sm font-medium transition ${
                  active ? 'text-[#202871]' : 'text-[#858BBD] hover:text-[#42498A]'
                }`}
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                <TabIcon kind={item.icon} />
                {item.label}
                {item.id === 'email' && mailboxOn ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32]" aria-hidden />
                ) : null}
                {active ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#202871]" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="p-5 md:p-7">
          {tab === 'profile' ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionIntro
                  title="Account details"
                  subtitle={
                    editMode === 'account'
                      ? 'Update how you appear across FraudAware'
                      : 'Signed-in information from your FraudAware login'
                  }
                />
                {editMode === 'none' ? (
                  <button
                    type="button"
                    onClick={startEditAccount}
                    className="rounded-lg border border-[#E5E7EE] px-3.5 py-2 text-sm font-semibold transition hover:bg-[#F7F8FE]"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {editMode === 'account' ? (
                <div className="mt-5 space-y-5">
                  <div className="flex flex-wrap items-center gap-4">
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarSrc}
                        alt=""
                        className="h-16 w-16 rounded-2xl object-cover ring-1 ring-[#E8EAF4]"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF0F8]">
                        <span
                          className="text-base font-semibold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {initialsFromName(accountForm.fullName || displayName)}
                        </span>
                      </div>
                    )}
                    <div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => onAvatarPicked(e.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => avatarInputRef.current?.click()}
                        className="rounded-lg border border-[#E5E7EE] px-3.5 py-2 text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-70"
                        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                      >
                        Change photo
                      </button>
                      <p
                        className="mt-1 text-xs"
                        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                      >
                        JPG, PNG, or WebP
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Full name"
                      value={accountForm.fullName}
                      onChange={(value) =>
                        setAccountForm((prev) => ({ ...prev, fullName: value }))
                      }
                      required
                    />
                    <Field
                      label={isCompany ? 'Role' : 'Headline'}
                      value={accountForm.headline}
                      onChange={(value) =>
                        setAccountForm((prev) => ({ ...prev, headline: value }))
                      }
                      placeholder={isCompany ? 'e.g. HR Manager' : 'e.g. Talent Partner at Virtusa'}
                    />
                    <Field
                      label="Location"
                      value={accountForm.location}
                      onChange={(value) =>
                        setAccountForm((prev) => ({ ...prev, location: value }))
                      }
                      placeholder="City, country"
                    />
                    <div>
                      <label
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                      >
                        Email
                      </label>
                      <p
                        className="rounded-xl border border-[#EEF0F8] bg-[#F7F8FE] px-3.5 py-2.5 text-sm"
                        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                      >
                        {user?.email || '—'}
                      </p>
                      <p
                        className="mt-1 text-xs"
                        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                      >
                        Email can’t be changed here
                      </p>
                    </div>
                  </div>

                  <EditActions
                    busy={busy}
                    onCancel={cancelEdit}
                    onSave={() => void saveAccount()}
                  />
                </div>
              ) : (
                <dl className="mt-5 divide-y divide-[#EEF0F8] rounded-xl border border-[#EEF0F8]">
                  <DetailRow label="Full name" value={user?.fullName} />
                  <DetailRow label="Email" value={user?.email} mono />
                  <DetailRow label="Account type" value={titleCase(user?.accountType)} />
                  <DetailRow
                    label="Status"
                    value={
                      <StatusPill
                        tone={accountActive ? 'success' : 'neutral'}
                        label={titleCase(user?.accountStatus || 'Active')}
                      />
                    }
                  />
                  <DetailRow
                    label={isCompany ? 'Role' : 'Headline'}
                    value={user?.headline || user?.role}
                  />
                  <DetailRow label="Location" value={user?.location} />
                  <DetailRow label="Last login" value={formatDate(user?.lastLoginAt)} />
                </dl>
              )}
            </div>
          ) : null}

          {tab === 'company' ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionIntro
                  title={isCompany ? 'Company workspace' : 'Active workspace'}
                  subtitle={
                    editMode === 'company'
                      ? 'Update company details shown on your hiring profile'
                      : 'Used for jobs, applicants, and InChat'
                  }
                />
                {editMode === 'none' ? (
                  <button
                    type="button"
                    onClick={startEditCompany}
                    className="rounded-lg border border-[#E5E7EE] px-3.5 py-2 text-sm font-semibold transition hover:bg-[#F7F8FE]"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {editMode === 'company' ? (
                <div className="mt-5 space-y-5">
                  <div className="flex flex-wrap items-center gap-4">
                    {companyLogoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={companyLogoSrc}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover ring-1 ring-[#E8EAF4]"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F4F5FB]">
                        <span
                          className="text-sm font-bold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {initialsFromName(companyForm.name || companyName)}
                        </span>
                      </div>
                    )}
                    <div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => onLogoPicked(e.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => logoInputRef.current?.click()}
                        className="rounded-lg border border-[#E5E7EE] px-3.5 py-2 text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-70"
                        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                      >
                        Change logo
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Company name"
                      value={companyForm.name}
                      onChange={(value) =>
                        setCompanyForm((prev) => ({ ...prev, name: value }))
                      }
                      required
                    />
                    <Field
                      label="Website"
                      value={companyForm.website}
                      onChange={(value) =>
                        setCompanyForm((prev) => ({ ...prev, website: value }))
                      }
                      placeholder="https://"
                    />
                    <Field
                      label="Industry"
                      value={companyForm.industry}
                      onChange={(value) =>
                        setCompanyForm((prev) => ({ ...prev, industry: value }))
                      }
                    />
                    <Field
                      label="Registration no."
                      value={companyForm.registrationNumber}
                      onChange={(value) =>
                        setCompanyForm((prev) => ({
                          ...prev,
                          registrationNumber: value,
                        }))
                      }
                    />
                    <div className="sm:col-span-2">
                      <Field
                        label="Address"
                        value={companyForm.address}
                        onChange={(value) =>
                          setCompanyForm((prev) => ({ ...prev, address: value }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
                        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                      >
                        About
                      </label>
                      <textarea
                        value={companyForm.description}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        rows={4}
                        className="w-full rounded-xl border border-[#E5E7EE] bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#202871]"
                        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                      />
                    </div>
                  </div>

                  <EditActions
                    busy={busy}
                    onCancel={cancelEdit}
                    onSave={() => void saveCompany()}
                  />
                </div>
              ) : (
                <>
                  <div className="mt-5 flex items-center gap-4 rounded-xl border border-[#EEF0F8] px-4 py-4">
                    {companyLogoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={companyLogoSrc}
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover ring-1 ring-[#E8EAF4]"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F4F5FB]">
                        <span
                          className="text-sm font-bold"
                          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                        >
                          {initialsFromName(companyName)}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-base font-semibold"
                        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                      >
                        {companyName}
                      </p>
                      <p
                        className="mt-0.5 truncate text-sm"
                        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                      >
                        {user?.company?.industry ||
                          (activeWorkspace?.id
                            ? `Workspace · ${activeWorkspace.id.slice(-8)}`
                            : 'No workspace selected')}
                      </p>
                    </div>
                    {user?.company?.isVerified ? (
                      <StatusPill tone="success" label="Verified" />
                    ) : null}
                  </div>

                  <dl className="mt-5 divide-y divide-[#EEF0F8] rounded-xl border border-[#EEF0F8]">
                    <DetailRow
                      label="Company name"
                      value={user?.company?.name || activeWorkspace?.name}
                    />
                    <DetailRow label="Website" value={user?.company?.website} mono />
                    <DetailRow label="Industry" value={user?.company?.industry} />
                    <DetailRow label="Address" value={user?.company?.address} />
                    <DetailRow
                      label="Registration no."
                      value={user?.company?.registrationNumber}
                    />
                  </dl>

                  {user?.company?.description ? (
                    <div className="mt-5">
                      <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                      >
                        About
                      </p>
                      <p
                        className="mt-2 text-sm leading-relaxed"
                        style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                      >
                        {user.company.description}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === 'email' ? (
            <div>
              <SectionIntro
                title="Hiring mailbox"
                subtitle="Connect Gmail or Outlook to message applicants from FraudAware"
              />

              <div
                className={`mt-5 flex flex-col gap-4 rounded-xl border px-5 py-5 sm:flex-row sm:items-center sm:justify-between ${
                  mailboxOn
                    ? 'border-[#C8E6C9] bg-[#F4FBF5]'
                    : 'border-[#E8EAF4] bg-[#F8F9FD]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      mailboxOn ? 'bg-[#E8F5E9]' : 'bg-white ring-1 ring-[#E8EAF4]'
                    }`}
                  >
                    <MailGlyph connected={mailboxOn} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="text-sm font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
                        {mailboxOn ? 'Mailbox connected' : 'No mailbox connected'}
                      </p>
                      <StatusPill
                        tone={mailboxOn ? 'success' : 'warn'}
                        label={mailboxOn ? 'Ready' : 'Action needed'}
                      />
                    </div>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                    >
                      {mailboxOn
                        ? emailStatus?.email
                        : 'Connect once — then email candidates without leaving the dashboard.'}
                    </p>
                    {mailboxOn && emailStatus?.connectedAt ? (
                      <p
                        className="mt-1 text-xs"
                        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                      >
                        Connected {formatDate(emailStatus.connectedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {mailboxOn ? (
                    <>
                      <Link
                        href={`${basePath}/email`}
                        className="rounded-lg bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2160]"
                        style={{ fontFamily: 'var(--font-poppins)' }}
                      >
                        Open inbox
                      </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                        className="rounded-lg border border-[#E5E7EE] bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-70"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Disconnect
              </button>
                    </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect('google')}
                        className="rounded-lg bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2160] disabled:opacity-70"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Connect Gmail
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect('microsoft')}
                        className="rounded-lg border border-[#E5E7EE] bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-70"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  Connect Outlook
                </button>
              </>
            )}
          </div>
        </div>
      </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#E5E7EE] bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#202871]"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      />
    </div>
  );
}

function EditActions({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-[#EEF0F8] pt-5">
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded-lg bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a2160] disabled:opacity-70"
        style={{ fontFamily: 'var(--font-poppins)' }}
      >
        {busy ? 'Saving…' : 'Save changes'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onCancel}
        className="rounded-lg border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#F7F8FE] disabled:opacity-70"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        Cancel
      </button>
    </div>
  );
}

function SectionIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h4
        className="text-base font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {title}
      </h4>
      <p
        className="mt-1 text-sm"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function GlanceStat({
  label,
  value,
  hint,
  href,
  onClick,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  onClick?: () => void;
  tone?: 'neutral' | 'success' | 'warn';
}) {
  const valueColor =
    tone === 'success' ? '#2E7D32' : tone === 'warn' ? '#EF6C00' : colors.navy;

  const className =
    'flex flex-col bg-white px-4 py-3.5 text-left transition hover:bg-[#FAFBFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#202871]';

  const content = (
    <>
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums"
        style={{ color: valueColor, fontFamily: 'var(--font-poppins)' }}
      >
        {value}
      </p>
      <p
        className="mt-0.5 text-xs"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {hint}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href || '#'} className={className}>
      {content}
    </Link>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
}) {
  const display =
    value == null || value === '' ? (
      <span style={{ color: colors.muted }}>—</span>
    ) : typeof value === 'string' ? (
      <span className={mono ? 'normal-case' : undefined}>{value}</span>
    ) : (
      value
    );

  return (
    <div className="grid gap-1 px-4 py-3.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-6">
      <dt
        className="text-sm"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </dt>
      <dd
        className={`min-w-0 text-sm font-medium ${mono ? '' : 'capitalize'}`}
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {display}
      </dd>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warn' | 'neutral';
}) {
  const styles =
    tone === 'success'
      ? { color: '#2E7D32', background: '#E8F5E9' }
      : tone === 'warn'
        ? { color: '#EF6C00', background: '#FFF3E0' }
        : { color: colors.body, background: '#EEF0F8' };

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ ...styles, fontFamily: 'var(--font-poppins)' }}
    >
      {label}
    </span>
  );
}

function ChevronRight() {
  return (
    <svg className="h-3.5 w-3.5 opacity-60" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MailGlyph({ connected }: { connected: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke={connected ? '#2E7D32' : '#202871'}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

function TabIcon({ kind }: { kind: string }) {
  const common = {
    className: 'h-4 w-4',
    fill: 'none' as const,
    viewBox: '0 0 24 24',
    strokeWidth: 1.7,
    stroke: 'currentColor',
    'aria-hidden': true as const,
  };

  if (kind === 'mail') {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
        />
      </svg>
    );
  }

  if (kind === 'building') {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}
