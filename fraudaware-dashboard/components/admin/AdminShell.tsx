'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, logout as logoutRequest } from '@/lib/api/authApi';
import type { AuthUser } from '@/lib/api/authTypes';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { canAccessPortal, clearSession, getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type Props = {
  children: ReactNode;
  title?: string;
};

const config = portalConfigs.admin;

const navItems = [
  { href: `${config.basePath}/dashboard`, label: 'Dashboard' },
  { href: `${config.basePath}/users`, label: 'Users' },
  { href: `${config.basePath}/verification`, label: 'Verification' },
  { href: `${config.basePath}/jobs`, label: 'Jobs' },
] as const;

export default function AdminShell({ children, title }: Props) {
  const router = useRouter();
  const pathname = usePathname();
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
        if (!canAccessPortal('admin', response.user.accountType)) {
          clearSession();
          router.replace(config.loginPath);
          return;
        }
        if (!cancelled) setUser(response.user);
      } catch {
        clearSession();
        router.replace(config.loginPath);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    validateSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    const token = getStoredToken();
    setIsLoggingOut(true);
    try {
      if (token) await logoutRequest(token);
    } catch {
      /* clear local session anyway */
    } finally {
      clearSession();
      router.replace(config.loginPath);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FE]">
        <p style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}>
          Loading admin portal...
        </p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#F7F8FE]">
      <aside className="hidden w-60 shrink-0 border-r border-[#EEF0F8] bg-white md:flex md:flex-col">
        <div className="border-b border-[#EEF0F8] px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#858BBD]">
            {config.portalLabel}
          </p>
          <p
            className="mt-1 text-lg font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            FraudAware
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-[#EEF0F8] text-[#202871]'
                    : 'text-[#42498A] hover:bg-[#F7F8FE]'
                }`}
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#EEF0F8] p-4">
          <div className="mb-2 min-w-0">
            <p
              className="truncate text-sm font-medium"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {user.fullName}
            </p>
            <p
              className="truncate text-xs"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="mt-1 w-full rounded-xl border border-[#E5E7EE] px-3 py-2 text-sm font-medium transition hover:bg-[#F7F8FE] disabled:opacity-70"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b border-[#EEF0F8] bg-white px-4 py-3 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-base font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              FraudAware Admin
            </p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-medium"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Sign out
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    active ? 'bg-[#202871] text-white' : 'bg-[#EEF0F8] text-[#42498A]'
                  }`}
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>

        <div className="border-b border-[#EEF0F8] bg-white px-4 py-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#858BBD]">
            Super Admin
          </p>
          <h1
            className="mt-1 text-xl font-semibold md:text-2xl"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            {title ?? 'Admin Dashboard'}
          </h1>
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
