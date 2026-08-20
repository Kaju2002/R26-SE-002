'use client';

import AdminPlaceholderPage from '@/components/admin/AdminPlaceholderPage';

export default function AdminReportsPage() {
  return (
    <AdminPlaceholderPage
      title="Reports & Flags"
      description="Review user reports and flagged content in one moderation queue. Data will be connected later."
      upcoming={[
        'Flagged jobs, profiles, and messages',
        'Reporter details and reason codes',
        'Triage statuses: new, reviewing, resolved',
        'Escalate or dismiss with notes',
      ]}
    />
  );
}
