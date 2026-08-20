'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/lib/api/authTypes';
import type { PortalType } from '@/lib/auth/portalConfig';
import { colors } from '@/lib/theme/colors';
import { useInchat } from '@/components/recruiter/inchat/InchatProvider';

type Props = {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
  basePath: string;
  portalLabel: string;
  user: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  /** Compact variant used under the mobile chip nav */
  mobile?: boolean;
};

function UserAvatar({
  user,
  size = 36,
  fallbackLetter,
}: {
  user: AuthUser;
  size?: number;
  fallbackLetter: string;
}) {
  const src = user.avatar || user.company?.logo || '';
  const initials =
    `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
    fallbackLetter;

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

function MenuIcon({ kind }: { kind: 'profile' | 'inchat' | 'email' }) {
  const paths = {
    profile: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    ),
    inchat: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.199C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    ),
    email: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
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

export default function EmployerTopNav({
  portal,
  basePath,
  portalLabel: _portalLabel,
  user,
  isLoggingOut,
  onLogout,
  sidebarCollapsed = false,
  onToggleSidebar,
  mobile = false,
}: Props) {
  const pathname = usePathname();
  const { threadsForList } = useInchat();
  const [menuOpen, setMenuOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const unreadTotal = useMemo(
    () =>
      (threadsForList ?? []).reduce((sum, thread) => sum + (thread.unreadCount || 0), 0),
    [threadsForList]
  );

  const shortLabel = portal === 'company' ? 'Company' : 'Recruiter';
  const displayName =
    portal === 'company' && user.company?.name ? user.company.name : user.fullName;
  const roleLine =
    user.headline ||
    user.role ||
    (portal === 'company' ? 'Company account' : 'Recruiter');

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
    { href: `${basePath}/inchat`, label: 'InChat' },
    { href: `${basePath}/jobs`, label: 'Jobs' },
    { href: `${basePath}/email`, label: 'Email' },
  ];

  const appsLinks = [
    { href: `${basePath}/dashboard`, label: 'Dashboard', subtitle: 'Hiring overview' },
    { href: `${basePath}/applicants`, label: 'Applicants', subtitle: 'Review candidates' },
    { href: `${basePath}/profile`, label: 'Profile', subtitle: 'Account & company' },
  ];

  const menuLinks = [
    {
      href: `${basePath}/profile`,
      title: 'My Profile',
      subtitle: 'Account & company',
      kind: 'profile' as const,
    },
    {
      href: `${basePath}/inchat`,
      title: 'InChat',
      subtitle: 'Messages with applicants',
      kind: 'inchat' as const,
    },
    {
      href: `${basePath}/email`,
      title: 'Email',
      subtitle: 'Connected mailbox',
      kind: 'email' as const,
    },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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
        <UserAvatar user={user} size={35} fallbackLetter={shortLabel[0]} />
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
              <UserAvatar user={user} size={48} fallbackLetter={shortLabel[0]} />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                >
                  {displayName}
                </p>
                <p
                  className="truncate text-xs"
                  style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                >
                  {roleLine}
                </p>
                <p
                  className="mt-1 flex items-center gap-1.5 truncate text-xs"
                  style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
                >
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-[#858BBD]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.6}
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  <span className="truncate">{user.email}</span>
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
      <header className="relative z-30 bg-white px-4 py-3">
        <div className="flex w-full items-center justify-between gap-3">
          <p
            className="truncate text-base font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            FraudAware {shortLabel}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              href={`${basePath}/inchat`}
              label={
                unreadTotal > 0
                  ? `${unreadTotal} unread InChat messages`
                  : 'Notifications'
              }
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
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
              {unreadTotal > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#5D87FF] ring-2 ring-white" />
              ) : null}
            </IconButton>
            {profileDropdown}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="relative z-30 hidden h-[70px] items-center bg-white px-4 md:flex lg:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        {/* Left cluster — Modernize-style: toggle · search · quick links */}
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
              label="Search"
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
                  const q = searchQuery.trim();
                  setSearchOpen(false);
                  if (q) {
                    window.location.href = `${basePath}/jobs?q=${encodeURIComponent(q)}`;
                  } else {
                    window.location.href = `${basePath}/jobs`;
                  }
                }}
              >
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search jobs..."
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
                className="absolute left-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-[#EEF0F8] bg-white py-1 shadow-[0_12px_40px_rgba(32,40,113,0.12)]"
              >
                {appsLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setAppsOpen(false)}
                    className="block px-3.5 py-2.5 transition hover:bg-[#F7F8FE]"
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

          <nav className="hidden items-center gap-0.5 lg:flex">
            {quickLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'bg-[#F2F6FF] text-[#202871]'
                      : 'text-[#5B6473] hover:bg-[#F7F8FE] hover:text-[#202871]'
                  }`}
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right cluster — utilities + profile */}
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            href={`${basePath}/inchat`}
            label={
              unreadTotal > 0
                ? `${unreadTotal} unread InChat messages`
                : 'Notifications'
            }
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
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
            {unreadTotal > 0 ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#5D87FF] ring-2 ring-white" />
            ) : null}
          </IconButton>

          {profileDropdown}
        </div>
      </div>
    </header>
  );
}
