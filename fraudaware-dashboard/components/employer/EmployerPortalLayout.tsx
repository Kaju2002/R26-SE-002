'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import EmployerShell from '@/components/employer/EmployerShell';
import type { PortalType } from '@/lib/auth/portalConfig';

type Props = {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
  children: ReactNode;
};

export default function EmployerPortalLayout({ portal, children }: Props) {
  const pathname = usePathname();
  const isAuthRoute =
    pathname.includes('/login') || pathname.includes('/register');

  if (isAuthRoute) return children;

  const fullBleed =
    pathname.includes('/inchat') || /\/email\/?$/.test(pathname);

  return (
    <EmployerShell portal={portal} fullBleed={fullBleed}>
      {children}
    </EmployerShell>
  );
}
