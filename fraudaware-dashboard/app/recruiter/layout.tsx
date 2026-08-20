'use client';

import type { ReactNode } from 'react';
import EmployerPortalLayout from '@/components/employer/EmployerPortalLayout';

export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return <EmployerPortalLayout portal="recruiter">{children}</EmployerPortalLayout>;
}
