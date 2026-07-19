'use client';

import { Suspense } from 'react';
import EmployerInchatPage from '@/components/employer/EmployerInchatPage';

export default function RecruiterInchatPage() {
  return (
    <Suspense fallback={null}>
      <EmployerInchatPage portal="recruiter" />
    </Suspense>
  );
}
