'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import EmployerShell from '@/components/employer/EmployerShell';
import { getEmailManagementBaseUrl } from '@/lib/api/apiConfig';
import type { PortalType } from '@/lib/auth/portalConfig';
import { portalConfigs } from '@/lib/auth/portalConfig';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

export default function EmployerEmailCallbackPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = portalConfigs[portal].basePath;
  const [message, setMessage] = useState('Connecting your mailbox...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const token = getStoredToken();

    if (!token || !code) {
      setMessage('Missing authorization code. Please try connecting again.');
      return;
    }

    const params = new URLSearchParams({
      code,
      ...(state ? { state } : {}),
    });

    fetch(`${getEmailManagementBaseUrl()}/api/email/callback?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.message === 'string'
              ? data.message
              : 'Could not complete mailbox connection.'
          );
        }
        setMessage('Mailbox connected. Redirecting...');
        router.replace(`${basePath}/email`);
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error ? error.message : 'Could not complete mailbox connection.'
        );
      });
  }, [basePath, router, searchParams]);

  return (
    <EmployerShell portal={portal}>
      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
        <p style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}>{message}</p>
      </div>
    </EmployerShell>
  );
}
