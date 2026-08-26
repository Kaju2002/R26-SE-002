'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import AdminTopNav from '@/components/admin/AdminTopNav';
import { getCurrentUser, logout as logoutRequest } from '@/lib/api/authApi';
import type { AuthUser } from '@/lib/api/authTypes';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { canAccessPortal, clearSession, getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type Props = {
  children: ReactNode;
  /** Optional override; otherwise derived from the current admin route. */
  title?: string;
};

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Admin Dashboard',
  users: 'User Management',
  verification: 'Verification Queue',
  jobs: 'Job Moderation',
  reports: 'Reports & Flags',
  audit: 'Audit log',
  settings: 'Settings',
  support: 'Support tickets',
};

function titleFromPath(pathname: string): string | undefined {
  const segment = pathname.replace(config.basePath, '').split('/').filter(Boolean)[0];
  if (!segment) return undefined;
  return PAGE_TITLES[segment];
}

type NavIconId =
  | 'dashboard'
  | 'users'
  | 'verification'
  | 'jobs'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'support';

const config = portalConfigs.admin;

const navItems: { href: string; label: string; icon: NavIconId }[] = [
  { href: `${config.basePath}/dashboard`, label: 'Dashboard', icon: 'dashboard' },
  { href: `${config.basePath}/users`, label: 'Users', icon: 'users' },
  { href: `${config.basePath}/verification`, label: 'Verification', icon: 'verification' },
  { href: `${config.basePath}/jobs`, label: 'Jobs', icon: 'jobs' },
  { href: `${config.basePath}/reports`, label: 'Reports', icon: 'reports' },
  { href: `${config.basePath}/audit`, label: 'Audit log', icon: 'audit' },
  { href: `${config.basePath}/settings`, label: 'Settings', icon: 'settings' },
  { href: `${config.basePath}/support`, label: 'Support', icon: 'support' },
];

function SidebarNavIcon({ id, className }: { id: NavIconId; className?: string }) {
  const common = {
    className: className ?? 'h-5 w-5 shrink-0',
    fill: 'none' as const,
    viewBox: '0 0 24 24',
    strokeWidth: 1.6,
    stroke: 'currentColor',
    'aria-hidden': true as const,
  };

  switch (id) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
          />
        </svg>
      );
    case 'verification':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
      );
    case 'jobs':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
          />
        </svg>
      );
    case 'audit':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.174.1.331.245.45.43l.15.188a1.125 1.125 0 001.682.183l.908-.91c.39-.39 1.03-.39 1.42 0l1.834 1.834c.39.39.39 1.03 0 1.42l-.91.908a1.125 1.125 0 00.183 1.682l.188.15c.185.119.33.276.43.45.184.332.496.582.87.645l1.281.213c.542.09.94.56.94 1.11v2.593c0 .55-.398 1.02-.94 1.11l-1.281.213a1.125 1.125 0 00-.87.645 2.247 2.247 0 01-.43.45l-.188.15a1.125 1.125 0 00-.183 1.682l.91.908c.39.39.39 1.03 0 1.42l-1.834 1.834c-.39.39-1.03.39-1.42 0l-.908-.91a1.125 1.125 0 00-1.682.183l-.15.188a2.247 2.247 0 01-.45.43 1.125 1.125 0 00-.645.87l-.213 1.281c-.09.542-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281a1.125 1.125 0 00-.87-.645 2.247 2.247 0 01-.45-.43l-.15-.188a1.125 1.125 0 00-1.682-.183l-.908.91c-.39.39-1.03.39-1.42 0l-1.834-1.834c-.39-.39-.39-1.03 0-1.42l.91-.908a1.125 1.125 0 00-.183-1.682l-.188-.15a2.247 2.247 0 01-.43-.45 1.125 1.125 0 00-.645-.87L3.94 15.297c-.542-.09-.94-.56-.94-1.11v-2.593c0-.55.398-1.02.94-1.11l1.281-.213c.374-.063.686-.313.87-.645.1-.174.245-.331.43-.45l.15-.188a1.125 1.125 0 00-.183-1.682l-.91-.908c-.39-.39-.39-1.03 0-1.42L7.416 3.94c.39-.39 1.03-.39 1.42 0l.908.91a1.125 1.125 0 001.682-.183l.15-.188c.119-.185.276-.33.45-.43.332-.184.582-.496.645-.87L9.594 3.94z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    case 'support':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.928 1.12 1.228 1.79a9.006 9.006 0 01.928 3.574c0 1.28-.333 2.48-.928 3.574a8.97 8.97 0 01-1.228 1.79 9.027 9.027 0 01-1.652 1.306M7.288 19.67a9.027 9.027 0 01-1.652-1.306 8.97 8.97 0 01-1.228-1.79A9.006 9.006 0 013.48 13c0-1.28.333-2.48.928-3.574a8.97 8.97 0 011.228-1.79 9.027 9.027 0 011.652-1.306m9.424 0a9.03 9.03 0 00-9.424 0m9.424 0A8.97 8.97 0 0120.52 13c0 4.97-4.03 9-9 9s-9-4.03-9-9a8.97 8.97 0 012.788-6.67m9.424 0L12 12.75"
          />
        </svg>
      );
  }
}

function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex h-[70px] items-center justify-center px-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(145deg, #202871 0%, #4A5CC0 100%)',
            fontFamily: 'var(--font-poppins)',
          }}
          title="FraudAware"
        >
          FA
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[70px] items-center gap-3 px-5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{
          background: 'linear-gradient(145deg, #202871 0%, #4A5CC0 100%)',
          fontFamily: 'var(--font-poppins)',
        }}
      >
        FA
      </div>
      <div className="min-w-0">
        <p
          className="truncate text-lg font-semibold leading-tight"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          FraudAware
        </p>
        <p
          className="truncate text-xs"
          style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
        >
          Super admin
        </p>
      </div>
    </div>
  );
}

export default function AdminShell({ children, title }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedTitle = title ?? titleFromPath(pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('fraudaware.admin.sidebarCollapsed');
      if (raw === '1') setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

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
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}>
          Loading admin portal...
        </p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-white">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-[#EEF0F8] bg-white transition-[width] duration-200 md:flex md:flex-col ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <SidebarBrand collapsed={sidebarCollapsed} />

        <nav className="flex-1 space-y-1 px-3 pb-3 pt-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center rounded-xl text-sm font-medium transition ${
                  sidebarCollapsed
                    ? 'justify-center px-2 py-2.5'
                    : 'gap-3 px-3.5 py-2.5'
                } ${
                  active
                    ? 'bg-[#F2F6FF] text-[#202871]'
                    : 'text-[#5B6473] hover:bg-[#F7F8FE] hover:text-[#202871]'
                }`}
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                <SidebarNavIcon id={item.icon} />
                {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed ? (
          <div className="p-4">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                  style={{ backgroundColor: '#EEF0F8' }}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
                  <span
                    className="text-xs font-bold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    {`${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
                      'A'}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
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
            </div>
          </div>
        ) : null}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-white">
        <AdminTopNav
          basePath={config.basePath}
          user={user}
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() =>
            setSidebarCollapsed((value) => {
              const next = !value;
              try {
                sessionStorage.setItem(
                  'fraudaware.admin.sidebarCollapsed',
                  next ? '1' : '0'
                );
              } catch {
                /* ignore */
              }
              return next;
            })
          }
        />

        <div className="sticky top-0 z-40 bg-white md:hidden">
          <AdminTopNav
            basePath={config.basePath}
            user={user}
            isLoggingOut={isLoggingOut}
            onLogout={handleLogout}
            mobile
          />
          <div className="border-b border-[#EEF0F8] px-4 pb-3">
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                      active ? 'bg-[#202871] text-white' : 'bg-[#F2F6FF] text-[#42498A]'
                    }`}
                    style={{ fontFamily: 'var(--font-poppins)' }}
                  >
                    <SidebarNavIcon id={item.icon} className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {resolvedTitle ? (
          <div className="border-b border-[#EEF0F8] bg-white px-4 py-4 md:px-6 lg:px-8">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Super admin
            </p>
            <h1
              className="mt-1 text-xl font-semibold md:text-2xl"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {resolvedTitle}
            </h1>
          </div>
        ) : null}

        <main className="w-full flex-1 bg-white px-4 py-6 md:px-6 md:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
