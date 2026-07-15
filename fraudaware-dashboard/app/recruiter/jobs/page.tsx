'use client';

import RecruiterShell from '@/components/recruiter/RecruiterShell';
import { colors } from '@/lib/theme/colors';

export default function RecruiterJobsPage() {
  return (
    <RecruiterShell>
      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
        <h2
          className="text-xl font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Jobs
        </h2>
        <p
          className="mt-3 text-base leading-relaxed"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          Job posting and management will be connected to job-management service here.
        </p>
      </div>
    </RecruiterShell>
  );
}
