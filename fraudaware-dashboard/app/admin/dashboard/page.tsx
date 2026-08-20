'use client';

import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { colors } from '@/lib/theme/colors';

export default function AdminDashboardPage() {
  return (
    <AdminShell title="Admin Dashboard">
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
          <h2
            className="text-xl font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Platform overview
          </h2>
          <p
            className="mt-3 text-base leading-relaxed"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            Manage FraudAware users, review account status, and keep the platform
            safe for jobseekers, recruiters, and companies.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/users"
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-95"
              style={{
                backgroundColor: colors.navy,
                fontFamily: 'var(--font-poppins)',
              }}
            >
              Manage users
            </Link>
            <Link
              href="/admin/verification"
              className="rounded-xl border border-[#E5E7EE] px-5 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Verification queue
            </Link>
            <Link
              href="/admin/jobs"
              className="rounded-xl border border-[#E5E7EE] px-5 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE]"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              Job moderation
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm">
          <h3
            className="text-base font-semibold"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Available now
          </h3>
          <ul
            className="mt-3 list-disc space-y-1.5 pl-5 text-sm"
            style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
          >
            <li>List and search jobseekers, recruiters, and companies</li>
            <li>Filter by account type and status</li>
            <li>Suspend, ban, or restore accounts (mock data)</li>
            <li>Review company legitimacy and approve or reject (mock data)</li>
            <li>Review flagged/fake job posts and force-close listings (mock data)</li>
            <li>Reports, Audit log, Settings, and Support tabs ready (data later)</li>
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}
