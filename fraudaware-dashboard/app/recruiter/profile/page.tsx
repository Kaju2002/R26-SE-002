'use client';

import { useEffect, useState } from 'react';
import RecruiterShell from '@/components/recruiter/RecruiterShell';
import type { AuthUser } from '@/lib/api/authTypes';
import { colors } from '@/lib/theme/colors';
import { getStoredUser } from '@/lib/auth/session';

export default function RecruiterProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <RecruiterShell>
      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
        <h2
          className="text-xl font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Profile
        </h2>
        <dl className="mt-6 space-y-4">
          <div>
            <dt
              className="text-sm font-medium"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Name
            </dt>
            <dd
              className="mt-1 text-base"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {user?.fullName ?? '—'}
            </dd>
          </div>
          <div>
            <dt
              className="text-sm font-medium"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Email
            </dt>
            <dd
              className="mt-1 text-base"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {user?.email ?? '—'}
            </dd>
          </div>
          <div>
            <dt
              className="text-sm font-medium"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Account type
            </dt>
            <dd
              className="mt-1 text-base capitalize"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {user?.accountType ?? '—'}
            </dd>
          </div>
        </dl>
      </div>
    </RecruiterShell>
  );
}
