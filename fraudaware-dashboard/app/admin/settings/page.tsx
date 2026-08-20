'use client';

import AdminPlaceholderPage from '@/components/admin/AdminPlaceholderPage';

export default function AdminSettingsPage() {
  return (
    <AdminPlaceholderPage
      title="Settings"
      description="Platform configuration and feature flags for FraudAware. Data will be connected later."
      upcoming={[
        'Feature flags for portals and modules',
        'Moderation thresholds and auto-flag rules',
        'Email / notification defaults',
        'Maintenance mode and system announcements',
      ]}
    />
  );
}
