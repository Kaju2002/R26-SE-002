'use client';

import DashboardShell from '@/components/auth/DashboardShell';
import { portalConfigs } from '@/lib/auth/portalConfig';

const config = portalConfigs.admin;

export default function AdminDashboardPage() {
  return (
    <DashboardShell config={config} portalType="admin" title="Admin Dashboard">
      {(user) => (
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-[#202871]">
            Welcome back, {user.firstName}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#42498A]">
            You are signed in as a super admin. Platform management screens will
            be added here next.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}
