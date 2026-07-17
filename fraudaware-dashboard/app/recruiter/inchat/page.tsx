'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import RecruiterShell from '@/components/recruiter/RecruiterShell';
import InchatConversationHeader from '@/components/recruiter/inchat/InchatConversationHeader';
import InchatEmptyState from '@/components/recruiter/inchat/InchatEmptyState';
import InchatFilterChips from '@/components/recruiter/inchat/InchatFilterChips';
import { ChevronDownIcon } from '@/components/recruiter/inchat/InchatIcons';
import InchatInboxHeader from '@/components/recruiter/inchat/InchatInboxHeader';
import InchatThreadPanel from '@/components/recruiter/inchat/InchatThreadPanel';
import InchatThreadDetailsPanel from '@/components/recruiter/inchat/InchatThreadDetailsPanel';
import InchatThreadRow from '@/components/recruiter/inchat/InchatThreadRow';
import { useInchat } from '@/components/recruiter/inchat/InchatProvider';
import type { AuthUser } from '@/lib/api/authTypes';
import { getStoredUser } from '@/lib/auth/session';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import { INCHAT_FILTER_OPTIONS, type InchatFilterId, type InchatThread } from '@/lib/inchat/types';

function matchesFilter(thread: InchatThread, filterId: InchatFilterId): boolean {
  if (filterId === 'unread') return thread.unreadCount > 0;
  return thread.filterTags.includes(filterId);
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

function InchatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { loaded, error, threadsForList, isPeerTyping, getPeerPresence, clearConversation } =
    useInchat();
  const [recruiter, setRecruiter] = useState<AuthUser | null>(null);
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState<InchatFilterId>('focused');

  const threads = useMemo(
    () =>
      threadsForList.filter(
        (thread) =>
          (isDesktop || matchesFilter(thread, filterId)) && matchesQuery(thread, query)
      ),
    [filterId, isDesktop, query, threadsForList]
  );

  const selectedThreadId = searchParams.get('thread');
  const selectedThread = selectedThreadId
    ? threadsForList.find((thread) => thread.id === selectedThreadId)
    : undefined;
  const selectedPresence = selectedThread
    ? getPeerPresence(selectedThread.id)
    : { isOnline: false, lastSeenAt: null };

  useEffect(() => {
    queueMicrotask(() => setRecruiter(getStoredUser()));
  }, []);

  useEffect(() => {
    if (!isDesktop || !loaded || threads.length === 0) return;

    const hasValidSelection =
      selectedThreadId && threads.some((thread) => thread.id === selectedThreadId);

    if (!hasValidSelection) {
      router.replace(`/recruiter/inchat?thread=${threads[0].id}`, { scroll: false });
    }
  }, [isDesktop, loaded, router, selectedThreadId, threads]);

  const rowMode = isDesktop ? 'split' : 'stack';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:m-4 lg:rounded-xl lg:border lg:border-[#EEF0F8] lg:bg-white lg:shadow-sm">
      <div className="flex min-h-0 flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Conversation list */}
        <div className="flex min-h-0 w-full flex-col overflow-hidden border-[#EEF0F8] bg-white lg:w-[320px] lg:shrink-0 lg:border-r">
          <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#EEF0F8] px-5">
            {recruiter?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recruiter.avatar}
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
                  {recruiter
                    ? `${recruiter.firstName?.[0] ?? ''}${recruiter.lastName?.[0] ?? ''}`
                    : 'R'}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold"
                style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
              >
                {recruiter?.fullName ?? 'Recruiter'}
              </p>
              <p
                className="truncate text-xs"
                style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
              >
                Recruiter
              </p>
            </div>
          </div>

          <InchatInboxHeader query={query} onQueryChange={setQuery} />
          <div className="px-5 pb-3 pt-1 lg:hidden">
            <InchatFilterChips
              options={INCHAT_FILTER_OPTIONS}
              activeId={filterId}
              onSelect={setFilterId}
            />
          </div>
          <div className="hidden items-center px-5 pb-3 pt-1 lg:flex">
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium"
              style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
              aria-label="Recent chats"
            >
              Recent Chats
              <ChevronDownIcon width={16} height={16} strokeWidth={2} />
            </button>
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
                    router.push(`/recruiter/inchat?thread=${thread.id}`, { scroll: false })
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Active conversation — desktop split pane */}
        <div className="hidden min-h-0 min-w-0 flex-1 overflow-hidden flex-col lg:flex">
          {selectedThread ? (
            <div className="flex min-h-0 flex-1 overflow-hidden flex-col">
              <InchatConversationHeader
                thread={selectedThread}
                isTyping={isPeerTyping(selectedThread.id)}
                isOnline={selectedPresence.isOnline}
                lastSeenAt={selectedPresence.lastSeenAt}
                onClearChat={() => clearConversation(selectedThread.id)}
              />
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

export default function RecruiterInchatPage() {
  return (
    <RecruiterShell fullBleed>
      <InchatWorkspace />
    </RecruiterShell>
  );
}
