'use client';

import AdminPlaceholderPage from '@/components/admin/AdminPlaceholderPage';

export default function AdminSupportPage() {
  return (
    <AdminPlaceholderPage
      title="Support tickets"
      description="Help-desk style tickets from users and employers. Data will be connected later."
      upcoming={[
        'Open, in progress, and closed tickets',
        'Assign to admins and set priority',
        'Reply threads and internal notes',
        'Link tickets to users, jobs, or reports',
      ]}
    />
  );
}
