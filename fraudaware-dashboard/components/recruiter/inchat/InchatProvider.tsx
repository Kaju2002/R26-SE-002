'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { MOCK_INCHAT_THREADS } from '@/lib/inchat/mockThreads';
import { getMockMessagesForThread } from '@/lib/inchat/mockMessages';
import { threadsWithExtras } from '@/lib/inchat/threadsMerged';
import type { InchatMessage, InchatThread } from '@/lib/inchat/types';

const STORAGE_KEY = 'fa_recruiter_inchat_extras_v1';

type PersistShape = {
  extrasByThread: Record<string, InchatMessage[]>;
};

type InchatContextValue = {
  loaded: boolean;
  threadsForList: InchatThread[];
  appendRecruiterMessage: (threadId: string, body: string) => Promise<void>;
  getCombinedMessages: (threadId: string) => InchatMessage[];
};

const InchatContext = createContext<InchatContextValue | null>(null);

export function useInchat(): InchatContextValue {
  const context = useContext(InchatContext);
  if (!context) {
    throw new Error('useInchat must be used within InchatProvider');
  }
  return context;
}

export function InchatProvider({ children }: { children: ReactNode }) {
  const [extrasByThread, setExtrasByThread] = useState<Record<string, InchatMessage[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistShape;
        if (parsed.extrasByThread && typeof parsed.extrasByThread === 'object') {
          setExtrasByThread(parsed.extrasByThread);
        }
      }
    } catch {
      /* keep defaults */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ extrasByThread } satisfies PersistShape)
    );
  }, [extrasByThread, loaded]);

  const appendRecruiterMessage = useCallback(async (threadId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed || !MOCK_INCHAT_THREADS.some((thread) => thread.id === threadId)) {
      return;
    }

    const message: InchatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      threadId,
      role: 'recruiter',
      body: trimmed,
      timeLabel: new Date().toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
      createdAtIso: new Date().toISOString(),
    };

    setExtrasByThread((previous) => ({
      ...previous,
      [threadId]: [...(previous[threadId] ?? []), message],
    }));
  }, []);

  const getCombinedMessages = useCallback(
    (threadId: string) => [
      ...getMockMessagesForThread(threadId),
      ...(extrasByThread[threadId] ?? []),
    ],
    [extrasByThread]
  );

  const threadsForList = useMemo(
    () => threadsWithExtras(extrasByThread),
    [extrasByThread]
  );

  const value = useMemo(
    () => ({
      loaded,
      threadsForList,
      appendRecruiterMessage,
      getCombinedMessages,
    }),
    [loaded, threadsForList, appendRecruiterMessage, getCombinedMessages]
  );

  return <InchatContext.Provider value={value}>{children}</InchatContext.Provider>;
}
