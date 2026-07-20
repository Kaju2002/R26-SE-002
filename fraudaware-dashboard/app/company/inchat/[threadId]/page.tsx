'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import EmployerShell from '@/components/employer/EmployerShell';
import { useInchat } from '@/components/recruiter/inchat/InchatProvider';
import InchatThreadPanel from '@/components/recruiter/inchat/InchatThreadPanel';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useInchatBasePath } from '@/lib/inchat/InchatBasePathContext';
import { INCHAT_NAVY } from '@/lib/inchat/inchatStyles';

type PageProps = {
  params: Promise<{ threadId: string }>;
};

function MobileThreadContent({ threadId }: { threadId: string }) {
  const router = useRouter();
  const basePath = useInchatBasePath();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { loaded, threadsForList } = useInchat();
  const thread = threadsForList.find((entry) => entry.id === threadId);

  useEffect(() => {
    if (isDesktop) {
      router.replace(`${basePath}/inchat?thread=${threadId}`);
    }
  }, [basePath, isDesktop, router, threadId]);

  if (!loaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}>
          Loading conversation...
        </p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 text-center shadow-sm">
        <p style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}>
          Conversation not found.
        </p>
        <Link
          href={`${basePath}/inchat`}
          className="mt-4 inline-block text-sm font-medium text-[#2563EB]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Back to InChat
        </Link>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}>
          Opening conversation...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <InchatThreadPanel thread={thread} showBack />
    </div>
  );
}

export default function CompanyInchatThreadPage({ params }: PageProps) {
  const { threadId } = use(params);

  return (
    <EmployerShell portal="company" fullBleed>
      <MobileThreadContent threadId={threadId} />
    </EmployerShell>
  );
}
