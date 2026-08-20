'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, logout as logoutRequest } from '@/lib/api/authApi';
import type { AuthUser } from '@/lib/api/authTypes';
import { portalConfigs, type PortalType } from '@/lib/auth/portalConfig';
import { canAccessPortal, clearSession, getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';
import { InchatProvider } from '@/components/recruiter/inchat/InchatProvider';
import { InchatBasePathProvider } from '@/lib/inchat/InchatBasePathContext';
import {
  EmployerWorkspaceProvider,
  useEmployerWorkspace,
} from '@/components/employer/EmployerWorkspaceContext';
import EmployerTopNav from '@/components/employer/EmployerTopNav';

type Props = {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
  children: ReactNode;
  /** When true, main area fills height without extra padding (InChat views). */
  fullBleed?: boolean;
};

type NavIconId =
  | 'dashboard'
  | 'inchat'
  | 'email'
  | 'jobs'
  | 'applicants'
  | 'profile';

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
    case 'inchat':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.199C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
      );
    case 'email':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
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
    case 'applicants':
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
          />
        </svg>
      );
    case 'profile':
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
}

function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  const { activeWorkspace, loading, error } = useEmployerWorkspace();

  if (loading) {
    return (
      <div className={`flex h-[70px] items-center ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <p className="truncate text-xs font-medium text-[#858BBD]">Loading...</p>
      </div>
    );
  }

  const name = activeWorkspace?.name || (error ? 'Workspace' : 'Company');
  const logo = activeWorkspace?.logo;
  const initial = (name[0] || 'C').toUpperCase();

  if (collapsed) {
    return (
      <div className="flex h-[70px] items-center justify-center px-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={name}
            className="h-9 w-9 rounded-xl object-cover"
            title={name}
          />
        ) : (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF0F8] text-sm font-bold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            title={name}
          >
            {initial}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[70px] items-center gap-3 px-5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className="h-10 w-10 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0F8] text-sm font-bold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {initial}
        </div>
      )}
      <p
        className="min-w-0 truncate text-lg font-semibold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {name}
      </p>
    </div>
  );
}

function MobileCompanyChip() {
  const { activeWorkspace } = useEmployerWorkspace();
  if (!activeWorkspace) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {activeWorkspace.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeWorkspace.logo}
          alt=""
          className="h-7 w-7 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF0F8] text-xs font-bold text-[#202871]">
          {(activeWorkspace.name[0] || 'C').toUpperCase()}
        </div>
      )}
      <p className="truncate text-sm font-semibold text-[#202871]">
        {activeWorkspace.name}
      </p>
    </div>
  );
}

export default function EmployerShell({
  portal,
  children,
  fullBleed = false,
}: Props) {
  const config = portalConfigs[portal];
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems: { href: string; label: string; icon: NavIconId }[] = [
    { href: `${config.basePath}/dashboard`, label: 'Dashboard', icon: 'dashboard' },
    { href: `${config.basePath}/inchat`, label: 'InChat', icon: 'inchat' },
    { href: `${config.basePath}/email`, label: 'Email', icon: 'email' },
    { href: `${config.basePath}/jobs`, label: 'Jobs', icon: 'jobs' },
    { href: `${config.basePath}/applicants`, label: 'Applicants', icon: 'applicants' },
    { href: `${config.basePath}/profile`, label: 'Profile', icon: 'profile' },
  ];

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
        if (!canAccessPortal(portal, response.user.accountType)) {
          clearSession();
          router.replace(config.loginPath);
          return;
        }
        if (!cancelled) {
          setUser(response.user);
          setSessionToken(token);
        }
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
  }, [router, portal, config.loginPath]);

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
          Loading {config.portalLabel.toLowerCase()}...
        </p>
      </div>
    );
  }

  if (!user || !sessionToken) return null;

  const shortLabel = portal === 'company' ? 'Company' : 'Recruiter';

  return (
    <InchatBasePathProvider basePath={config.basePath}>
    <EmployerWorkspaceProvider user={user} token={sessionToken}>
    <InchatProvider>
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
                {user.avatar || user.company?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar || user.company?.logo || ''}
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
                        shortLabel[0]}
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

        <div
          className={
            fullBleed
              ? 'flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-white'
              : 'flex min-h-screen min-w-0 flex-1 flex-col bg-white'
          }
        >
          <EmployerTopNav
            portal={portal}
            basePath={config.basePath}
            portalLabel={config.portalLabel}
            user={user}
            isLoggingOut={isLoggingOut}
            onLogout={handleLogout}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          />

          <div className="sticky top-0 z-40 bg-white md:hidden">
            <EmployerTopNav
              portal={portal}
              basePath={config.basePath}
              portalLabel={config.portalLabel}
              user={user}
              isLoggingOut={isLoggingOut}
              onLogout={handleLogout}
              mobile
            />
            <div className="border-b border-[#EEF0F8] px-4 pb-3">
              <MobileCompanyChip />
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
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

          <main
            className={
              fullBleed
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-white'
                : 'w-full flex-1 bg-white px-4 py-6 md:px-6 md:py-8 lg:px-8'
            }
          >
            {children}
          </main>
        </div>
      </div>
    </InchatProvider>
    </EmployerWorkspaceProvider>
    </InchatBasePathProvider>
  );
}
