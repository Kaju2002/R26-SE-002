'use client';

import AdminPlaceholderPage from '@/components/admin/AdminPlaceholderPage';

export default function AdminAuditPage() {
  return (
    <AdminPlaceholderPage
      title="Audit log"
      description="Track who changed what across the FraudAware platform. Data will be connected later."
      upcoming={[
        'Admin actions: suspend, ban, approve, reject, force-close',
        'Actor, target, timestamp, and before/after values',
        'Filter by admin, action type, and date range',
        'Export for compliance reviews',
      ]}
    />
  );
}
