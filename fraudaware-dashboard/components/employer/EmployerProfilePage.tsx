'use client';

import { useEffect, useState } from 'react';
import {
  disconnectEmail,
  getEmailConnectUrl,
  getEmailStatus,
  type EmailStatus,
} from '@/lib/api/emailApi';
import type { AuthUser } from '@/lib/api/authTypes';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken, getStoredUser } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

export default function EmployerProfilePage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const basePath = portalConfigs[portal].basePath;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    const token = getStoredToken();
    if (!token) return;
    getEmailStatus(token)
      .then(setEmailStatus)
      .catch(() => setEmailStatus({ connected: false, email: null, connectedAt: null }));
  }, []);

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

  return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
          <h2
            className="text-xl font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Profile
          </h2>
          <dl className="mt-6 space-y-4">
            <ProfileRow label="Name" value={user?.fullName} />
            <ProfileRow label="Email" value={user?.email} />
            <ProfileRow label="Account type" value={user?.accountType} />
            {portal === 'company' ? (
              <>
                <ProfileRow label="Company" value={user?.company?.name} />
                <ProfileRow label="Website" value={user?.company?.website} />
                <ProfileRow label="Industry" value={user?.company?.industry} />
              </>
            ) : (
              <ProfileRow label="Agency / headline" value={user?.headline || user?.company?.name} />
            )}
          </dl>
        </div>

        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
          <h3
            className="text-lg font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            In-app email (Nylas)
          </h3>
          <p
            className="mt-2 text-sm"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Connect your Gmail or Outlook mailbox to email applicants from the dashboard.
          </p>

          {message ? (
            <p
              className="mt-3 text-sm text-[#2E7D32]"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-red-600" style={{ fontFamily: 'var(--font-poppins)' }}>
              {error}
            </p>
          ) : null}

          <p
            className="mt-4 text-sm font-medium"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {emailStatus?.connected
              ? `Connected as ${emailStatus.email}`
              : 'No mailbox connected'}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {emailStatus?.connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold disabled:opacity-70"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Disconnect
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect('google')}
                  className="rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  Connect Gmail
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect('microsoft')}
                  className="rounded-xl border border-[#E5E7EE] px-4 py-2.5 text-sm font-semibold disabled:opacity-70"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  Connect Outlook
                </button>
              </>
            )}
          </div>
        </div>
      </div>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt
        className="text-sm font-medium"
        style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 text-base capitalize"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
