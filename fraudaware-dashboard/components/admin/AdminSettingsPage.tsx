'use client';

import { useEffect, useState } from 'react';
import {
  ADMIN_SETTINGS_STORAGE_KEY,
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
} from '@/lib/admin/settingsTypes';
import { colors } from '@/lib/theme/colors';

function cloneSettings(value: PlatformSettings): PlatformSettings {
  return JSON.parse(JSON.stringify(value)) as PlatformSettings;
}

function loadSettings(): PlatformSettings {
  if (typeof window === 'undefined') return cloneSettings(DEFAULT_PLATFORM_SETTINGS);
  try {
    const raw = window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
    if (!raw) return cloneSettings(DEFAULT_PLATFORM_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<PlatformSettings>;
    return {
      ...cloneSettings(DEFAULT_PLATFORM_SETTINGS),
      ...parsed,
      features: {
        ...DEFAULT_PLATFORM_SETTINGS.features,
        ...(parsed.features ?? {}),
      },
      emails: {
        ...DEFAULT_PLATFORM_SETTINGS.emails,
        ...(parsed.emails ?? {}),
      },
    };
  } catch {
    return cloneSettings(DEFAULT_PLATFORM_SETTINGS);
  }
}

function clampThreshold(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(() =>
    cloneSettings(DEFAULT_PLATFORM_SETTINGS)
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setSavedSnapshot(JSON.stringify(loaded));
  }, []);

  const dirty = JSON.stringify(settings) !== savedSnapshot;

  const update = (patch: Partial<PlatformSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setMessage(null);
    setError(null);
  };

  const updateFeature = (
    key: keyof PlatformSettings['features'],
    value: boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
    setMessage(null);
    setError(null);
  };

  const updateEmail = (
    key: keyof PlatformSettings['emails'],
    value: boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      emails: { ...prev.emails, [key]: value },
    }));
    setMessage(null);
    setError(null);
  };

  const onSave = () => {
    if (
      settings.fakeJobForceCloseEnabled &&
      settings.fakeJobForceCloseThreshold <= settings.fakeJobFlagThreshold
    ) {
      setError(
        'Force-close threshold must be higher than the flag threshold.'
      );
      setMessage(null);
      return;
    }

    setSaving(true);
    try {
      const next = {
        ...settings,
        fakeJobFlagThreshold: clampThreshold(settings.fakeJobFlagThreshold),
        fakeJobForceCloseThreshold: clampThreshold(
          settings.fakeJobForceCloseThreshold
        ),
        announcement: settings.announcement.trim(),
      };
      window.localStorage.setItem(
        ADMIN_SETTINGS_STORAGE_KEY,
        JSON.stringify(next)
      );
      setSettings(next);
      setSavedSnapshot(JSON.stringify(next));
      setError(null);
      setMessage('Settings saved on this device. Backend wiring comes later.');
    } catch {
      setError('Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    const defaults = cloneSettings(DEFAULT_PLATFORM_SETTINGS);
    setSettings(defaults);
    setMessage(null);
    setError(null);
  };

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border border-[#EEF0F8] bg-gradient-to-br from-[#F7F8FE] via-white to-[#EEF2FF] p-5 shadow-sm md:p-6">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Platform configuration
          </p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Control how CareerNet stays safe
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Tune moderation thresholds, feature flags, notifications, and
            maintenance. Saved locally for now (demo-ready).
          </p>
        </div>

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

        <SettingsSection
          title="Safety & moderation"
          subtitle="Rules that protect jobseekers from scam listings"
        >
          <ToggleRow
            label="Require verified company to publish jobs"
            description="Unverified companies can draft, but cannot go live until approved."
            checked={settings.requireVerifiedToPublish}
            onChange={(checked) =>
              update({ requireVerifiedToPublish: checked })
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Fake-job flag threshold"
              hint="Score at or above this value sends a job to moderation (0–1)."
              value={settings.fakeJobFlagThreshold}
              onChange={(value) =>
                update({ fakeJobFlagThreshold: clampThreshold(value) })
              }
            />
            <NumberField
              label="Force-close threshold"
              hint="Only used when auto force-close is enabled."
              value={settings.fakeJobForceCloseThreshold}
              disabled={!settings.fakeJobForceCloseEnabled}
              onChange={(value) =>
                update({ fakeJobForceCloseThreshold: clampThreshold(value) })
              }
            />
          </div>

          <ToggleRow
            label="Auto force-close very high-risk jobs"
            description="Automatically take down listings above the force-close threshold."
            checked={settings.fakeJobForceCloseEnabled}
            onChange={(checked) =>
              update({ fakeJobForceCloseEnabled: checked })
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Feature flags"
          subtitle="Turn product modules on or off without a redeploy"
        >
          <ToggleRow
            label="InChat"
            description="Recruiter ↔ jobseeker messaging."
            checked={settings.features.inchat}
            onChange={(checked) => updateFeature('inchat', checked)}
          />
          <ToggleRow
            label="Employer Check"
            description="AI / registry employer legitimacy checks."
            checked={settings.features.employerCheck}
            onChange={(checked) => updateFeature('employerCheck', checked)}
          />
          <ToggleRow
            label="Analytics"
            description="Employer analytics dashboards."
            checked={settings.features.analytics}
            onChange={(checked) => updateFeature('analytics', checked)}
          />
          <ToggleRow
            label="Detect (mobile)"
            description="Scan message / safety tools in the mobile app."
            checked={settings.features.detect}
            onChange={(checked) => updateFeature('detect', checked)}
          />
        </SettingsSection>

        <SettingsSection
          title="Email notifications"
          subtitle="What the platform should email by default"
        >
          <ToggleRow
            label="Verification decisions"
            description="Notify companies when verification is approved or rejected."
            checked={settings.emails.onVerificationDecision}
            onChange={(checked) =>
              updateEmail('onVerificationDecision', checked)
            }
          />
          <ToggleRow
            label="Job force-close"
            description="Notify posters when a listing is force-closed."
            checked={settings.emails.onJobForceClose}
            onChange={(checked) => updateEmail('onJobForceClose', checked)}
          />
          <ToggleRow
            label="Account restricted"
            description="Notify users when suspended or banned."
            checked={settings.emails.onAccountRestricted}
            onChange={(checked) => updateEmail('onAccountRestricted', checked)}
          />
        </SettingsSection>

        <SettingsSection
          title="System"
          subtitle="Maintenance mode and platform-wide announcement"
        >
          <ToggleRow
            label="Maintenance mode"
            description="Show a maintenance banner and block new job publishes."
            checked={settings.maintenanceMode}
            onChange={(checked) => update({ maintenanceMode: checked })}
          />
          <label className="block">
            <span
              className="mb-1.5 block text-sm font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Announcement banner
            </span>
            <textarea
              value={settings.announcement}
              onChange={(event) => update({ announcement: event.target.value })}
              rows={3}
              placeholder="Optional message shown on employer / admin dashboards…"
              className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            />
          </label>
        </SettingsSection>

        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEF0F8] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <p
            className="text-xs"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Reset defaults
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="rounded-xl bg-[#202871] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SettingsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-[#EEF0F8] bg-white p-5 shadow-sm md:p-6">
      <div>
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
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[#EEF0F8] px-4 py-3">
      <div className="min-w-0">
        <p
          className="text-sm font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {label}
        </p>
        <p
          className="mt-0.5 text-xs leading-relaxed"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-[#202871]' : 'bg-[#D1D5DB]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-sm font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </span>
      <input
        type="number"
        min={0}
        max={1}
        step={0.05}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-[#E5E7EE] bg-[#F7F8FE] px-3 py-2.5 text-sm outline-none focus:border-[#202871] disabled:opacity-50"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      />
      <span
        className="mt-1 block text-xs"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {hint}
      </span>
    </label>
  );
}
