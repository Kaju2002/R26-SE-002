'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Shared chrome for all /admin/* routes except login.
 * Keeps the sidebar mounted across Dashboard → Users → Jobs, etc.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return children;
  }

  return <AdminShell>{children}</AdminShell>;
}
