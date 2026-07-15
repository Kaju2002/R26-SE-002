'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';
import RecruiterShell from '@/components/recruiter/RecruiterShell';
import InchatThreadPanel from '@/components/recruiter/inchat/InchatThreadPanel';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { getMockThreadById } from '@/lib/inchat/mockThreads';
import { INCHAT_NAVY } from '@/lib/inchat/inchatStyles';

type PageProps = {
  params: Promise<{ threadId: string }>;
};

export default function RecruiterInchatThreadPage({ params }: PageProps) {
  const { threadId } = use(params);
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const thread = getMockThreadById(threadId);

  useEffect(() => {
    if (isDesktop) {
      router.replace(`/recruiter/inchat?thread=${threadId}`);
    }
  }, [isDesktop, router, threadId]);

  if (!thread) {
    return (
      <RecruiterShell>
        <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 text-center shadow-sm">
          <p style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}>
            Conversation not found.
          </p>
          <Link
            href="/recruiter/inchat"
            className="mt-4 inline-block text-sm font-medium text-[#2563EB]"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            Back to InChat
          </Link>
        </div>
      </RecruiterShell>
    );
  }

  if (isDesktop) {
    return (
      <RecruiterShell fullBleed>
        <div className="flex min-h-[50vh] items-center justify-center">
          <p style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}>
            Opening conversation...
          </p>
        </div>
      </RecruiterShell>
    );
  }

  return (
    <RecruiterShell fullBleed>
      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <InchatThreadPanel thread={thread} showBack />
      </div>
    </RecruiterShell>
  );
}
