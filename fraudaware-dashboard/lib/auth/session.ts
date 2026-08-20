import type { AccountType, AuthUser } from '@/lib/api/authTypes';
import type { PortalType } from '@/lib/auth/portalConfig';

const TOKEN_STORAGE_KEY = 'fa_auth_token';
const USER_STORAGE_KEY = 'fa_auth_user';
const TOKEN_COOKIE = 'fa_auth_token';
const ACCOUNT_TYPE_COOKIE = 'fa_account_type';

const ONE_DAY_SECONDS = 24 * 60 * 60;
const SEVEN_DAYS_SECONDS = 7 * ONE_DAY_SECONDS;

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function saveSession(token: string, user: AuthUser, rememberDevice: boolean) {
  if (typeof window === 'undefined') return;

  const maxAge = rememberDevice ? SEVEN_DAYS_SECONDS : ONE_DAY_SECONDS;

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  setCookie(TOKEN_COOKIE, token, maxAge);
  setCookie(ACCOUNT_TYPE_COOKIE, user.accountType, maxAge);
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Updates cached user without changing the auth token / cookie lifetime. */
export function updateStoredUser(user: AuthUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  clearCookie(TOKEN_COOKIE);
  clearCookie(ACCOUNT_TYPE_COOKIE);
}

export function canAccessPortal(
  portal: PortalType,
  accountType: AccountType
): boolean {
  if (portal === 'admin') return accountType === 'superadmin';
  if (portal === 'recruiter') return accountType === 'recruiter';
  if (portal === 'company') return accountType === 'company';
  return false;
}
