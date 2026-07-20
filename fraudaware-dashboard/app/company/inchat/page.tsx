'use client';

import { Suspense } from 'react';
import EmployerInchatPage from '@/components/employer/EmployerInchatPage';

export default function CompanyInchatPage() {
  return (
    <Suspense fallback={null}>
      <EmployerInchatPage portal="company" />
    </Suspense>
  );
}
