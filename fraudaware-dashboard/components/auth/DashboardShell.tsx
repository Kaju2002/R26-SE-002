'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout as logoutRequest } from '@/lib/api/authApi';
import type { AuthUser } from '@/lib/api/authTypes';
import type { PortalConfig } from '@/lib/auth/portalConfig';
import { canAccessPortal, clearSession, getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type Props = {
  config: PortalConfig;
  portalType: 'admin' | 'recruiter';
  title: string;
  children: (user: AuthUser) => ReactNode;
};

export default function DashboardShell({
  config,
  portalType,
  title,
  children,
}: Props) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      const token = getStoredToken();

      if (!token) {
        router.replace(config.loginPath);
        return;
      }

      try {
        const response = await getCurrentUser(token);

        if (!canAccessPortal(portalType, response.user.accountType)) {
          clearSession();
          router.replace(config.loginPath);
          return;
        }

        if (!cancelled) {
          setUser(response.user);
        }
      } catch {
        clearSession();
        router.replace(config.loginPath);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    validateSession();

    return () => {
      cancelled = true;
    };
  }, [config.loginPath, portalType, router]);

  const handleLogout = async () => {
    const token = getStoredToken();
    setIsLoggingOut(true);

    try {
      if (token) {
        await logoutRequest(token);
      }
    } catch {
      // Clear local session even if logout API fails.
    } finally {
      clearSession();
      router.replace(config.loginPath);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FE]">
        <p style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}>
          Loading dashboard...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FE]">
      <header className="border-b border-[#EEF0F8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-[#858BBD]">{config.portalLabel}</p>
            <h1
              className="text-2xl font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p
                className="text-sm font-medium"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {user.fullName}
              </p>
              <p
                className="text-sm"
                style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
              >
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-medium transition hover:bg-[#F7F8FE] disabled:opacity-70"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children(user)}</main>
    </div>
  );
}
