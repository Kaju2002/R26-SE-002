'use client';

import { Suspense } from 'react';
import EmployerEmailCallbackPage from '@/components/employer/EmployerEmailCallbackPage';

export default function CompanyEmailCallbackPage() {
  return (
    <Suspense fallback={null}>
      <EmployerEmailCallbackPage portal="company" />
    </Suspense>
  );
}
