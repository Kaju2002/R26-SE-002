'use client';

import type { ReactNode } from 'react';
import EmployerShell from '@/components/employer/EmployerShell';

type Props = {
  children: ReactNode;
  fullBleed?: boolean;
};

export default function RecruiterShell({ children, fullBleed = false }: Props) {
  return (
    <EmployerShell portal="recruiter" fullBleed={fullBleed}>
      {children}
    </EmployerShell>
  );
}
