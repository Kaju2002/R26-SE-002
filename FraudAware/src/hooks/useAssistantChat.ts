import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AssistantApiError,
  getAssistantSession,
  sendAssistantMessage,
  type AssistantAwaiting,
  type AssistantCheck,
  type AssistantChip,
  type AssistantImage,
  type AssistantVerdict,
} from '../api/assistantApi';

export type AssistantUiMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUri?: string;
};

export type AssistantChatError = { message: string; canRetry: boolean };

type Turn = { text?: string; chip?: AssistantChip; image?: AssistantImage };

type ServerState = {
  chips: AssistantChip[];
  awaiting: AssistantAwaiting;
  checks: AssistantCheck[];
  running: boolean;
  result: AssistantVerdict | null;
};

const POLL_MS = 3000;
const NEW_CHECK_CHIP = 'new_check';

/**
 * State for one assistant conversation. The server keeps the conversation; this hook mirrors it.
 * While a background check (the company check) runs, the session is polled for its result.
 * Requests run one at a time so a poll and a send never interleave.
 */
export function useAssistantChat(token: string | null) {
  const [messages, setMessages] = useState<AssistantUiMessage[]>([]);
  const [chips, setChips] = useState<AssistantChip[]>([]);
  const [awaiting, setAwaiting] = useState<AssistantAwaiting>('menu');
  const [checks, setChecks] = useState<AssistantCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AssistantVerdict | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<AssistantChatError | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  /** Number of server-side messages already shown. */
  const seenRef = useRef(0);
  const runningRef = useRef(false);
  const sendingRef = useRef(false);
  const lastTurnRef = useRef<Turn | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const nextIdRef = useRef(0);
  const startedRef = useRef(false);

  const newId = () => `m${nextIdRef.current++}`;

  const queue = useCallback(<T>(fn: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(fn, fn);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const applyState = useCallback((s: ServerState) => {
    setChips(s.chips);
    setAwaiting(s.awaiting);
    setChecks(s.checks);
    setRunning(s.running);
    setResult(s.result);
    runningRef.current = s.running;
  }, []);

  /** Add assistant messages written by background checks since the last look. */
  const sync = useCallback(
    async (skipText?: string) => {
      const sessionId = sessionIdRef.current;
      if (!token || !sessionId) return;
      const view = await getAssistantSession(token, sessionId);
      if (sessionIdRef.current !== sessionId) return;

      let skip = skipText;
      const fresh: AssistantUiMessage[] = [];
      for (const m of view.messages.slice(seenRef.current)) {
        if (m.role !== 'assistant') continue;
        if (skip !== undefined && m.text === skip) {
          skip = undefined;
          continue;
        }
        fresh.push({ id: newId(), role: 'assistant', text: m.text });
      }
      seenRef.current = view.messages.length;
      if (fresh.length) setMessages((prev) => [...prev, ...fresh]);
      applyState(view);
    },
    [applyState, token]
  );

  const post = useCallback(
    async (turn: Turn, showUserBubble: boolean) => {
      if (!token) {
        setError({ message: 'Your session has ended. Please log in again.', canRetry: false });
        return;
      }
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      setError(null);
      lastTurnRef.current = turn;

      if (showUserBubble && (turn.text || turn.chip || turn.image)) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'user',
            text: turn.text ?? turn.chip?.label ?? '',
            imageUri: turn.image?.uri,
          },
        ]);
      }

      try {
        await queue(async () => {
          const res = await sendAssistantMessage(token, {
            sessionId: sessionIdRef.current,
            text: turn.text,
            chip: turn.chip?.id,
            image: turn.image,
          });
          const wasRunning = runningRef.current;
          const reply: AssistantUiMessage = { id: newId(), role: 'assistant', text: res.reply };
          // The server logs the user's message too, except for an empty start or "new check".
          const loggedUserMessage = !!(turn.text || turn.image || (turn.chip && turn.chip.id !== NEW_CHECK_CHIP));

          if (res.session_id !== sessionIdRef.current) {
            sessionIdRef.current = res.session_id;
            seenRef.current = loggedUserMessage ? 2 : 1;
            setMessages((prev) => (turn.chip?.id === NEW_CHECK_CHIP ? [reply] : [...prev, reply]));
          } else {
            seenRef.current += 2;
            setMessages((prev) => [...prev, reply]);
          }
          applyState(res);
          lastTurnRef.current = null;

          if (wasRunning || res.running) {
            await sync(res.reply);
          }
        });
      } catch (e) {
        const unauthorised = e instanceof AssistantApiError && e.status === 401;
        const message =
          e instanceof AssistantApiError
            ? e.message
            : 'Could not reach the assistant. Check your connection and that the server is running.';
        setError({ message, canRetry: !unauthorised });
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [applyState, queue, sync, token]
  );

  useEffect(() => {
    if (token && !startedRef.current) {
      startedRef.current = true;
      void post({}, false);
    }
  }, [post, token]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      if (sendingRef.current) return;
      queue(() => sync()).catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [queue, running, sync]);

  const sendText = useCallback((text: string) => post({ text: text.trim() }, true), [post]);
  const sendChip = useCallback((chip: AssistantChip) => post({ chip }, true), [post]);
  const sendImage = useCallback((image: AssistantImage) => post({ image }, true), [post]);
  const retry = useCallback(() => {
    if (lastTurnRef.current) void post(lastTurnRef.current, false);
  }, [post]);

  return {
    messages,
    chips,
    awaiting,
    checks,
    running,
    result,
    sending,
    error,
    sendText,
    sendChip,
    sendImage,
    retry,
  };
}
