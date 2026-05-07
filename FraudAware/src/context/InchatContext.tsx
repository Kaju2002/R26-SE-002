import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INCHAT_THREADS, type InchatThread } from '../../data/inchatThreads';
import { getMessagesForThread, type InchatMessage } from '../../data/inchatMessages';
import { threadsWithExtras } from './inchatThreadsMerged';

const STORAGE_KEY = '@fraudaware/inchat_extras_v1';

type PersistShape = {
  extrasByThread: Record<string, InchatMessage[]>;
};

type InchatContextValue = {
  loaded: boolean;
  threadsForList: InchatThread[];
  appendUserMessage: (threadId: string, body: string) => Promise<void>;
  getCombinedMessages: (threadId: string) => InchatMessage[];
};

const InchatContext = createContext<InchatContextValue | null>(null);

export function useInchat(): InchatContextValue {
  const ctx = useContext(InchatContext);
  if (!ctx) {
    throw new Error('useInchat must be used within InchatProvider');
  }
  return ctx;
}

export function InchatProvider({ children }: { children: ReactNode }) {
  const [extrasByThread, setExtrasByThread] = useState<Record<string, InchatMessage[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as PersistShape;
          if (parsed.extrasByThread && typeof parsed.extrasByThread === 'object') {
            setExtrasByThread(parsed.extrasByThread);
          }
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ extrasByThread } satisfies PersistShape));
  }, [extrasByThread, loaded]);

  const appendUserMessage = useCallback(async (threadId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed || !INCHAT_THREADS.some((t) => t.id === threadId)) return;

    const msg: InchatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      threadId,
      role: 'user',
      body: trimmed,
      timeLabel: new Date().toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };

    setExtrasByThread((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), msg],
    }));
  }, []);

  const getCombinedMessages = useCallback(
    (threadId: string) => [...getMessagesForThread(threadId), ...(extrasByThread[threadId] ?? [])],
    [extrasByThread]
  );

  const threadsForList = useMemo(() => threadsWithExtras(extrasByThread), [extrasByThread]);

  const value = useMemo(
    () => ({
      loaded,
      threadsForList,
      appendUserMessage,
      getCombinedMessages,
    }),
    [loaded, threadsForList, appendUserMessage, getCombinedMessages]
  );

  return <InchatContext.Provider value={value}>{children}</InchatContext.Provider>;
}
