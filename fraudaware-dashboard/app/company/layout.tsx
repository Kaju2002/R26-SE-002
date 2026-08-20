'use client';

import type { ReactNode } from 'react';
import EmployerPortalLayout from '@/components/employer/EmployerPortalLayout';

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return <EmployerPortalLayout portal="company">{children}</EmployerPortalLayout>;
}
