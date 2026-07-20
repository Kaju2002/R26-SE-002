'use client';

import { Suspense } from 'react';
import EmployerEmailCallbackPage from '@/components/employer/EmployerEmailCallbackPage';

export default function RecruiterEmailCallbackPage() {
  return (
    <Suspense fallback={null}>
      <EmployerEmailCallbackPage portal="recruiter" />
    </Suspense>
  );
}
