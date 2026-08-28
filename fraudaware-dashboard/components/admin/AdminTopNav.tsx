'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/lib/api/authTypes';
import CareerNetLogo from '@/components/admin/CareerNetLogo';
import { colors } from '@/lib/theme/colors';

type Props = {
  basePath: string;
  user: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  mobile?: boolean;
};

function UserAvatar({
  user,
  size = 36,
}: {
  user: AuthUser;
  size?: number;
}) {
  const src = user.avatar || '';
  const initials =
    `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'A';

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, backgroundColor: '#EEF0F8' }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]"
      style={{ width: size, height: size }}
    >
      <span
        className="text-xs font-bold"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        {initials}
      </span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  href,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  href?: string;
}) {
  const className =
    'relative flex h-9 w-9 items-center justify-center rounded-full text-[#5B6473] transition hover:bg-[#F7F8FE] hover:text-[#202871]';

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {children}
    </button>
  );
}

function MenuIcon({
  kind,
}: {
  kind: 'dashboard' | 'users' | 'jobs' | 'verification' | 'reports' | 'audit' | 'settings' | 'support';
}) {
  const paths = {
    dashboard: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    ),
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
      />
    ),
    jobs: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    ),
    verification: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    ),
    reports: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
      />
    ),
    audit: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    settings: (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.174.1.331.245.45.43l.15.188a1.125 1.125 0 001.682.183l.908-.91c.39-.39 1.03-.39 1.42 0l1.834 1.834c.39.39.39 1.03 0 1.42l-.91.908a1.125 1.125 0 00.183 1.682l.188.15c.185.119.33.276.43.45.184.332.496.582.87.645l1.281.213c.542.09.94.56.94 1.11v2.593c0 .55-.398 1.02-.94 1.11l-1.281.213a1.125 1.125 0 00-.87.645 2.247 2.247 0 01-.43.45l-.188.15a1.125 1.125 0 00-.183 1.682l.91.908c.39.39.39 1.03 0 1.42l-1.834 1.834c-.39.39-1.03.39-1.42 0l-.908-.91a1.125 1.125 0 00-1.682.183l-.15.188a2.247 2.247 0 01-.45.43 1.125 1.125 0 00-.645.87l-.213 1.281c-.09.542-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281a1.125 1.125 0 00-.87-.645 2.247 2.247 0 01-.45-.43l-.15-.188a1.125 1.125 0 00-1.682-.183l-.908.91c-.39.39-1.03.39-1.42 0l-1.834-1.834c-.39-.39-.39-1.03 0-1.42l.91-.908a1.125 1.125 0 00-.183-1.682l-.188-.15a2.247 2.247 0 01-.43-.45 1.125 1.125 0 00-.645-.87L3.94 15.297c-.542-.09-.94-.56-.94-1.11v-2.593c0-.55.398-1.02.94-1.11l1.281-.213c.374-.063.686-.313.87-.645.1-.174.245-.331.43-.45l.15-.188a1.125 1.125 0 00-.183-1.682l-.91-.908c-.39-.39-.39-1.03 0-1.42L7.416 3.94c.39-.39 1.03-.39 1.42 0l.908.91a1.125 1.125 0 001.682-.183l.15-.188c.119-.185.276-.33.45-.43.332-.184.582-.496.645-.87L9.594 3.94z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </>
    ),
    support: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.928 1.12 1.228 1.79a9.006 9.006 0 01.928 3.574c0 1.28-.333 2.48-.928 3.574a8.97 8.97 0 01-1.228 1.79 9.027 9.027 0 01-1.652 1.306M7.288 19.67a9.027 9.027 0 01-1.652-1.306 8.97 8.97 0 01-1.228-1.79A9.006 9.006 0 013.48 13c0-1.28.333-2.48.928-3.574a8.97 8.97 0 011.228-1.79 9.027 9.027 0 011.652-1.306m9.424 0a9.03 9.03 0 00-9.424 0m9.424 0A8.97 8.97 0 0120.52 13c0 4.97-4.03 9-9 9s-9-4.03-9-9a8.97 8.97 0 012.788-6.67m9.424 0L12 12.75"
      />
    ),
  };

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF0F8]">
      <svg
        className="h-[18px] w-[18px] text-[#202871]"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.6}
        stroke="currentColor"
        aria-hidden
      >
        {paths[kind]}
      </svg>
    </span>
  );
}

export default function AdminTopNav({
  basePath,
  user,
  isLoggingOut,
  onLogout,
  sidebarCollapsed = false,
  onToggleSidebar,
  mobile = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen && !appsOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuOpen && !menuRef.current?.contains(target)) setMenuOpen(false);
      if (appsOpen && !appsRef.current?.contains(target)) setAppsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setAppsOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, appsOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const quickLinks = [
    { href: `${basePath}/users`, label: 'Users' },
    { href: `${basePath}/verification`, label: 'Verification' },
    { href: `${basePath}/jobs`, label: 'Jobs' },
  ];

  const appsLinks = [
    { href: `${basePath}/dashboard`, label: 'Dashboard', subtitle: 'Platform overview' },
    { href: `${basePath}/users`, label: 'Users', subtitle: 'Manage accounts' },
    { href: `${basePath}/verification`, label: 'Verification', subtitle: 'Review queue' },
    { href: `${basePath}/jobs`, label: 'Jobs', subtitle: 'Moderation' },
    { href: `${basePath}/reports`, label: 'Reports', subtitle: 'Flags & reports' },
    { href: `${basePath}/audit`, label: 'Audit log', subtitle: 'Who changed what' },
    { href: `${basePath}/settings`, label: 'Settings', subtitle: 'Config & flags' },
    { href: `${basePath}/support`, label: 'Support', subtitle: 'Help desk tickets' },
  ];

  const menuLinks = [
    {
      href: `${basePath}/dashboard`,
      title: 'Dashboard',
      subtitle: 'Platform overview',
      kind: 'dashboard' as const,
    },
    {
      href: `${basePath}/users`,
      title: 'Users',
      subtitle: 'Account management',
      kind: 'users' as const,
    },
    {
      href: `${basePath}/reports`,
      title: 'Reports',
      subtitle: 'Flags queue',
      kind: 'reports' as const,
    },
    {
      href: `${basePath}/settings`,
      title: 'Settings',
      subtitle: 'Platform config',
      kind: 'settings' as const,
    },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const goSearch = () => {
    const q = searchQuery.trim();
    setSearchOpen(false);
    if (q) {
      router.push(`${basePath}/users?q=${encodeURIComponent(q)}`);
    } else {
      router.push(`${basePath}/users`);
    }
  };

  const profileDropdown = (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setMenuOpen((open) => !open);
          setAppsOpen(false);
        }}
        className="flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-[#F7F8FE]"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Open profile menu"
      >
        <UserAvatar user={user} size={35} />
        {!mobile ? (
          <svg
            className={`mr-0.5 h-4 w-4 text-[#858BBD] transition ${menuOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        ) : null}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white shadow-[0_12px_40px_rgba(32,40,113,0.12)]"
        >
          <div className="border-b border-[#EEF0F8] px-4 py-4">
            <div className="flex items-start gap-3">
              <UserAvatar user={user} size={48} />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  {user.fullName}
                </p>
                <p
                  className="truncate text-xs"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  Super admin
                </p>
                <p
                  className="mt-1 truncate text-xs"
                  style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                >
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-0.5 p-2">
            {menuLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-[#F7F8FE]"
              >
                <MenuIcon kind={item.kind} />
                <span className="min-w-0">
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    {item.title}
                  </span>
                  <span
                    className="block text-xs"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    {item.subtitle}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <div className="border-t border-[#EEF0F8] p-3">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              disabled={isLoggingOut}
              className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE] disabled:opacity-70"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {isLoggingOut ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (mobile) {
    return (
      <header className="sticky top-0 z-40 bg-white px-4 py-3">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CareerNetLogo className="h-11 max-w-[200px]" />
            <span
              className="truncate text-xs font-medium"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Admin
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">{profileDropdown}</div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 hidden h-[70px] shrink-0 items-center border-b border-[#EEF0F8] bg-white px-4 md:flex lg:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1 lg:gap-2">
          <IconButton
            label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleSidebar}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.6}
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </IconButton>

          <div className="relative flex items-center">
            <IconButton
              label="Search users"
              onClick={() => {
                setSearchOpen((open) => !open);
                setAppsOpen(false);
                setMenuOpen(false);
              }}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.6}
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </IconButton>
            {searchOpen ? (
              <form
                className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-[#EEF0F8] bg-white p-2 shadow-[0_12px_40px_rgba(32,40,113,0.12)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  goSearch();
                }}
              >
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search users..."
                  className="w-full rounded-lg border border-[#E5E7EE] px-3 py-2 text-sm outline-none focus:border-[#202871]"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                />
              </form>
            ) : null}
          </div>

          <div className="relative hidden items-center sm:flex" ref={appsRef}>
            <button
              type="button"
              onClick={() => {
                setAppsOpen((open) => !open);
                setMenuOpen(false);
                setSearchOpen(false);
              }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition hover:bg-[#F7F8FE] ${
                appsOpen ? 'bg-[#F7F8FE] text-[#202871]' : 'text-[#5B6473]'
              }`}
              style={{ fontFamily: 'var(--font-poppins)' }}
              aria-expanded={appsOpen}
              aria-haspopup="menu"
            >
              Apps
              <svg
                className={`h-3.5 w-3.5 transition ${appsOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {appsOpen ? (
              <div
                role="menu"
                className="absolute left-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-[#EEF0F8] bg-white p-2 shadow-[0_12px_40px_rgba(32,40,113,0.12)]"
              >
                {appsLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setAppsOpen(false)}
                    className="block rounded-xl px-3 py-2.5 transition hover:bg-[#F7F8FE]"
                  >
                    <span
                      className="block text-sm font-semibold"
                      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="block text-xs"
                      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                    >
                      {item.subtitle}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <nav className="ml-1 hidden items-center gap-0.5 lg:flex">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                  isActive(item.href)
                    ? 'bg-[#F2F6FF] text-[#202871]'
                    : 'text-[#5B6473] hover:bg-[#F7F8FE] hover:text-[#202871]'
                }`}
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1">{profileDropdown}</div>
      </div>
    </header>
  );
}
