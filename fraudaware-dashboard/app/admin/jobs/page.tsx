'use client';

import { Suspense } from 'react';
import AdminJobsModerationPage from '@/components/admin/AdminJobsModerationPage';

export default function AdminJobsRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminJobsModerationPage />
    </Suspense>
  );
}
