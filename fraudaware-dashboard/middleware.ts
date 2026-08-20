import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_AUTH_PATHS = new Set([
  '/recruiter/login',
  '/recruiter/register',
  '/company/login',
  '/company/register',
  '/admin/login',
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('fa_auth_token')?.value;
  const accountType = request.cookies.get('fa_account_type')?.value;

  if (PUBLIC_AUTH_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const isAdminArea =
    pathname.startsWith('/admin/dashboard') ||
    pathname.startsWith('/admin/users') ||
    pathname.startsWith('/admin/verification') ||
    pathname.startsWith('/admin/jobs') ||
    pathname.startsWith('/admin/reports') ||
    pathname.startsWith('/admin/audit') ||
    pathname.startsWith('/admin/settings') ||
    pathname.startsWith('/admin/support');
  const isRecruiterArea =
    pathname.startsWith('/recruiter/dashboard') ||
    pathname.startsWith('/recruiter/inchat') ||
    pathname.startsWith('/recruiter/jobs') ||
    pathname.startsWith('/recruiter/applicants') ||
    pathname.startsWith('/recruiter/profile') ||
    pathname.startsWith('/recruiter/email') ||
    pathname.startsWith('/recruiter/interviews') ||
    pathname.startsWith('/recruiter/templates') ||
    pathname.startsWith('/recruiter/analytics') ||
    pathname.startsWith('/recruiter/team') ||
    pathname.startsWith('/recruiter/billing');
  const isCompanyArea =
    pathname.startsWith('/company/dashboard') ||
    pathname.startsWith('/company/inchat') ||
    pathname.startsWith('/company/jobs') ||
    pathname.startsWith('/company/applicants') ||
    pathname.startsWith('/company/profile') ||
    pathname.startsWith('/company/email') ||
    pathname.startsWith('/company/interviews') ||
    pathname.startsWith('/company/templates') ||
    pathname.startsWith('/company/analytics') ||
    pathname.startsWith('/company/team') ||
    pathname.startsWith('/company/billing');

  if (!isAdminArea && !isRecruiterArea && !isCompanyArea) {
    return NextResponse.next();
  }

  if (!token) {
    const loginPath = isAdminArea
      ? '/admin/login'
      : isCompanyArea
        ? '/company/login'
        : '/recruiter/login';
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (isAdminArea && accountType !== 'superadmin') {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (isRecruiterArea && accountType !== 'recruiter') {
    return NextResponse.redirect(new URL('/recruiter/login', request.url));
  }

  if (isCompanyArea && accountType !== 'company') {
    return NextResponse.redirect(new URL('/company/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/dashboard/:path*',
    '/admin/users/:path*',
    '/admin/verification/:path*',
    '/admin/jobs/:path*',
    '/admin/reports/:path*',
    '/admin/audit/:path*',
    '/admin/settings/:path*',
    '/admin/support/:path*',
    '/recruiter/dashboard/:path*',
    '/recruiter/inchat/:path*',
    '/recruiter/jobs/:path*',
    '/recruiter/applicants/:path*',
    '/recruiter/profile/:path*',
    '/recruiter/email/:path*',
    '/recruiter/interviews/:path*',
    '/recruiter/templates/:path*',
    '/recruiter/analytics/:path*',
    '/recruiter/team/:path*',
    '/recruiter/billing/:path*',
    '/company/dashboard/:path*',
    '/company/inchat/:path*',
    '/company/jobs/:path*',
    '/company/applicants/:path*',
    '/company/profile/:path*',
    '/company/email/:path*',
    '/company/interviews/:path*',
    '/company/templates/:path*',
    '/company/analytics/:path*',
    '/company/team/:path*',
    '/company/billing/:path*',
  ],
};
