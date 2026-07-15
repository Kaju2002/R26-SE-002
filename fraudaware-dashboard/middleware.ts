import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('fa_auth_token')?.value;
  const accountType = request.cookies.get('fa_account_type')?.value;

  if (pathname === '/recruiter/login' || pathname === '/admin/login') {
    return NextResponse.next();
  }

  const isAdminArea = pathname.startsWith('/admin/dashboard');
  const isRecruiterArea =
    pathname.startsWith('/recruiter/dashboard') ||
    pathname.startsWith('/recruiter/inchat') ||
    pathname.startsWith('/recruiter/jobs') ||
    pathname.startsWith('/recruiter/applicants') ||
    pathname.startsWith('/recruiter/profile');

  if (!isAdminArea && !isRecruiterArea) {
    return NextResponse.next();
  }

  if (!token) {
    const loginPath = isAdminArea ? '/admin/login' : '/recruiter/login';
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (isAdminArea && accountType !== 'superadmin') {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (isRecruiterArea && accountType !== 'recruiter') {
    return NextResponse.redirect(new URL('/recruiter/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/dashboard/:path*',
    '/recruiter/dashboard/:path*',
    '/recruiter/inchat/:path*',
    '/recruiter/jobs/:path*',
    '/recruiter/applicants/:path*',
    '/recruiter/profile/:path*',
  ],
};
