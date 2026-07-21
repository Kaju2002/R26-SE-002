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
    pathname.startsWith('/admin/jobs');
  const isRecruiterArea =
    pathname.startsWith('/recruiter/dashboard') ||
    pathname.startsWith('/recruiter/inchat') ||
    pathname.startsWith('/recruiter/jobs') ||
    pathname.startsWith('/recruiter/applicants') ||
    pathname.startsWith('/recruiter/profile') ||
    pathname.startsWith('/recruiter/email');
  const isCompanyArea =
    pathname.startsWith('/company/dashboard') ||
    pathname.startsWith('/company/inchat') ||
    pathname.startsWith('/company/jobs') ||
    pathname.startsWith('/company/applicants') ||
    pathname.startsWith('/company/profile') ||
    pathname.startsWith('/company/email');

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
    '/recruiter/dashboard/:path*',
    '/recruiter/inchat/:path*',
    '/recruiter/jobs/:path*',
    '/recruiter/applicants/:path*',
    '/recruiter/profile/:path*',
    '/recruiter/email/:path*',
    '/company/dashboard/:path*',
    '/company/inchat/:path*',
    '/company/jobs/:path*',
    '/company/applicants/:path*',
    '/company/profile/:path*',
    '/company/email/:path*',
  ],
};
