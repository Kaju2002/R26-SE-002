'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import InchatConversationHeader from '@/components/recruiter/inchat/InchatConversationHeader';
import InchatEmptyState from '@/components/recruiter/inchat/InchatEmptyState';
import InchatFilterChips from '@/components/recruiter/inchat/InchatFilterChips';
import InchatInboxHeader from '@/components/recruiter/inchat/InchatInboxHeader';
import InchatThreadPanel from '@/components/recruiter/inchat/InchatThreadPanel';
import InchatThreadDetailsPanel from '@/components/recruiter/inchat/InchatThreadDetailsPanel';
import InchatThreadRow from '@/components/recruiter/inchat/InchatThreadRow';
import { useInchat } from '@/components/recruiter/inchat/InchatProvider';
import type { AuthUser } from '@/lib/api/authTypes';
import type { PortalType } from '@/lib/auth/portalConfig';
import { getStoredUser } from '@/lib/auth/session';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useInchatBasePath } from '@/lib/inchat/InchatBasePathContext';
import { INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import { INCHAT_FILTER_OPTIONS, type InchatFilterId, type InchatThread } from '@/lib/inchat/types';

function matchesFilter(thread: InchatThread, filterId: InchatFilterId): boolean {
  switch (filterId) {
    case 'focused':
      return thread.status === 'active';
    case 'jobs':
      return thread.status !== 'archived' && Boolean(thread.jobId);
    case 'unread':
      return thread.status !== 'archived' && thread.unreadCount > 0;
    case 'saved':
      return Boolean(thread.saved);
    case 'archived':
      return thread.status === 'archived';
  }
}

function matchesQuery(thread: InchatThread, query: string): boolean {
  if (!query.trim()) return true;
  const search = query.trim().toLowerCase();
  return (
    thread.participantName.toLowerCase().includes(search) ||
    thread.lastMessagePreview.toLowerCase().includes(search) ||
    (thread.subtitle?.toLowerCase().includes(search) ?? false)
  );
}

function InchatWorkspace({ roleLabel }: { roleLabel: string }) {
  const router = useRouter();
  const basePath = useInchatBasePath();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const {
    loaded,
    error,
    threadsForList,
    isPeerTyping,
    getPeerPresence,
    clearConversation,
    setConversationSaved,
    setConversationStatus,
  } = useInchat();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState<InchatFilterId>('focused');
  const [statusError, setStatusError] = useState<string | null>(null);

  const threads = useMemo(
    () =>
      threadsForList.filter(
        (thread) =>
          matchesFilter(thread, filterId) && matchesQuery(thread, query)
      ),
    [filterId, query, threadsForList]
  );

  const selectedThreadId = searchParams.get('thread');
  const selectedThread = selectedThreadId
    ? threadsForList.find((thread) => thread.id === selectedThreadId)
    : undefined;
  const selectedPresence = selectedThread
    ? getPeerPresence(selectedThread.id)
    : { isOnline: false, lastSeenAt: null };

  useEffect(() => {
    queueMicrotask(() => setUser(getStoredUser()));
  }, []);

  useEffect(() => {
    if (!isDesktop || !loaded || threads.length === 0) return;

    const hasValidSelection =
      selectedThreadId && threads.some((thread) => thread.id === selectedThreadId);

    if (!hasValidSelection) {
      router.replace(`${basePath}/inchat?thread=${threads[0].id}`, { scroll: false });
    }
  }, [basePath, isDesktop, loaded, router, selectedThreadId, threads]);

  const rowMode = isDesktop ? 'split' : 'stack';
  const displayName =
    roleLabel === 'Company' && user?.company?.name
      ? user.company.name
      : user?.fullName ?? roleLabel;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:m-4 lg:rounded-xl lg:border lg:border-[#EEF0F8] lg:bg-white lg:shadow-sm">
      <div className="flex min-h-0 flex-1 overflow-hidden flex-col lg:flex-row">
        <div className="flex min-h-0 w-full flex-col overflow-hidden border-[#EEF0F8] bg-white lg:w-[320px] lg:shrink-0 lg:border-r">
          <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#EEF0F8] px-5">
            {user?.avatar || user?.company?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar || user.company?.logo || ''}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover"
                style={{ backgroundColor: '#EEF0F8' }}
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF0F8]">
                <span
                  className="text-sm font-bold"
                  style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
                >
                  {user
                    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`
                    : roleLabel[0]}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold"
                style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
              >
                {displayName}
              </p>
              <p
                className="truncate text-xs"
                style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
              >
                {roleLabel}
              </p>
            </div>
          </div>

          <InchatInboxHeader query={query} onQueryChange={setQuery} />
          <div className="border-b border-[#EEF0F8]">
            <InchatFilterChips
              options={INCHAT_FILTER_OPTIONS}
              activeId={filterId}
              onSelect={setFilterId}
            />
          </div>

          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
            {!loaded ? (
              <p
                className="px-4 py-8 text-center text-sm"
                style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
              >
                Loading conversations...
              </p>
            ) : error ? (
              <p
                className="px-4 py-8 text-center text-sm text-red-600"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {error}
              </p>
            ) : threads.length === 0 ? (
              <p
                className="px-4 py-8 text-center text-sm"
                style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
              >
                No conversations match your search.
              </p>
            ) : (
              threads.map((thread) => (
                <InchatThreadRow
                  key={thread.id}
                  thread={thread}
                  mode={rowMode}
                  isActive={thread.id === selectedThreadId}
                  onSelect={() =>
                    router.push(`${basePath}/inchat?thread=${thread.id}`, {
                      scroll: false,
                    })
                  }
                />
              ))
            )}
          </div>
        </div>

        <div className="hidden min-h-0 min-w-0 flex-1 overflow-hidden flex-col lg:flex">
          {selectedThread ? (
            <div className="flex min-h-0 flex-1 overflow-hidden flex-col">
              <InchatConversationHeader
                thread={selectedThread}
                isTyping={isPeerTyping(selectedThread.id)}
                isOnline={selectedPresence.isOnline}
                lastSeenAt={selectedPresence.lastSeenAt}
                onClearChat={() => clearConversation(selectedThread.id)}
                onBlock={async () => {
                  setStatusError(null);
                  try {
                    await setConversationStatus(selectedThread.id, 'blocked');
                  } catch (err) {
                    setStatusError(
                      err instanceof Error ? err.message : 'Could not block conversation.'
                    );
                  }
                }}
                onUnblock={async () => {
                  setStatusError(null);
                  try {
                    await setConversationStatus(selectedThread.id, 'active');
                  } catch (err) {
                    setStatusError(
                      err instanceof Error ? err.message : 'Could not unblock conversation.'
                    );
                  }
                }}
                onArchive={async () => {
                  setStatusError(null);
                  try {
                    await setConversationStatus(selectedThread.id, 'archived');
                  } catch (err) {
                    setStatusError(
                      err instanceof Error ? err.message : 'Could not archive conversation.'
                    );
                    throw err;
                  }
                }}
                onUnarchive={async () => {
                  setStatusError(null);
                  try {
                    await setConversationStatus(selectedThread.id, 'active');
                  } catch (err) {
                    setStatusError(
                      err instanceof Error ? err.message : 'Could not unarchive conversation.'
                    );
                    throw err;
                  }
                }}
                onSave={async () => {
                  setStatusError(null);
                  try {
                    await setConversationSaved(selectedThread.id, true);
                  } catch (err) {
                    setStatusError(
                      err instanceof Error ? err.message : 'Could not save conversation.'
                    );
                    throw err;
                  }
                }}
                onUnsave={async () => {
                  setStatusError(null);
                  try {
                    await setConversationSaved(selectedThread.id, false);
                  } catch (err) {
                    setStatusError(
                      err instanceof Error
                        ? err.message
                        : 'Could not remove saved conversation.'
                    );
                    throw err;
                  }
                }}
              />
              {statusError ? (
                <p
                  className="border-b bg-[#FEF3F2] px-4 py-2 text-center text-xs font-semibold text-[#B42318]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {statusError}
                </p>
              ) : null}
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <InchatThreadPanel thread={selectedThread} hideHeader />
                <InchatThreadDetailsPanel thread={selectedThread} hideHeaderSpacer />
              </div>
            </div>
          ) : (
            <InchatEmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

export default function EmployerInchatPage({
  portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  return <InchatWorkspace roleLabel={portal === 'company' ? 'Company' : 'Recruiter'} />;
}
