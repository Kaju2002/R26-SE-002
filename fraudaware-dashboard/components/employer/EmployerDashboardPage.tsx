'use client';

import Link from 'next/link';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { colors } from '@/lib/theme/colors';

export default function EmployerDashboardPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const config = portalConfigs[portal];
  const isCompany = portal === 'company';

  return (
      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
        <h2
          className="text-xl font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {isCompany
            ? 'Welcome to your company portal'
            : 'Welcome to your recruiter portal'}
        </h2>
        <p
          className="mt-3 text-base leading-relaxed"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          {isCompany
            ? 'Post company jobs, review applicants, chat in InChat, and email candidates from your connected mailbox.'
            : 'Post jobs for any employer, review applicants, chat in InChat, and email candidates from your connected mailbox.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`${config.basePath}/jobs`}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-95"
            style={{ backgroundColor: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Manage Jobs
          </Link>
          <Link
            href={`${config.basePath}/applicants`}
            className="rounded-xl border border-[#E5E7EE] px-5 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE]"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            View Applicants
          </Link>
          <Link
            href={`${config.basePath}/inchat`}
            className="rounded-xl border border-[#E5E7EE] px-5 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE]"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Open InChat
          </Link>
          <Link
            href={`${config.basePath}/profile`}
            className="rounded-xl border border-[#E5E7EE] px-5 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE]"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Connect Email
          </Link>
        </div>
      </div>
  );
}
