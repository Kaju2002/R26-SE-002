'use client';

import Link from 'next/link';
import RecruiterShell from '@/components/recruiter/RecruiterShell';
import { colors } from '@/lib/theme/colors';

export default function RecruiterDashboardPage() {
  return (
    <RecruiterShell>
      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
        <h2
          className="text-xl font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Welcome to your recruiter portal
        </h2>
        <p
          className="mt-3 text-base leading-relaxed"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          InChat is ready for demo conversations. Jobs and applicants management will be
          connected next.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/recruiter/inchat"
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-95"
            style={{ backgroundColor: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Open InChat
          </Link>
          <Link
            href="/recruiter/jobs"
            className="rounded-xl border border-[#E5E7EE] px-5 py-2.5 text-sm font-medium transition hover:bg-[#F7F8FE]"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            View Jobs
          </Link>
        </div>
      </div>
    </RecruiterShell>
  );
}
