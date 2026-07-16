'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  listChatConversations,
  listConversationMessages,
  sendConversationMessage,
  type ChatConversation,
  type ChatMessage,
} from '@/lib/api/chatApi';
import { getChatManagementBaseUrl } from '@/lib/api/apiConfig';
import { getApplicationById } from '@/lib/api/jobApi';
import { getStoredToken } from '@/lib/auth/session';
import type { InchatMessage, InchatThread } from '@/lib/inchat/types';

type PeerMeta = {
  name: string;
  initials: string;
  subtitle: string;
};

type InchatContextValue = {
  loaded: boolean;
  error: string | null;
  threadsForList: InchatThread[];
  appendRecruiterMessage: (threadId: string, body: string) => Promise<void>;
  getCombinedMessages: (threadId: string) => InchatMessage[];
  loadMessages: (threadId: string) => Promise<void>;
};

const InchatContext = createContext<InchatContextValue | null>(null);

function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'A';
}

function formatThread(
  conversation: ChatConversation,
  peerByConversationId: Record<string, PeerMeta>
): InchatThread {
  const peer = peerByConversationId[conversation.id];

  return {
    id: conversation.id,
    participantName: peer?.name || 'Applicant',
    subtitle: peer?.subtitle || `Application • ${conversation.applicationId.slice(-6)}`,
    avatarKind: 'person',
    initials: peer?.initials || 'A',
    lastMessagePreview: conversation.lastMessage?.preview || 'No messages yet',
    timestampLabel: formatTime(conversation.lastMessage?.sentAt || conversation.updatedAt),
    unreadCount: conversation.myUnread || 0,
    filterTags: conversation.myUnread > 0 ? ['focused', 'jobs', 'unread'] : ['focused', 'jobs'],
  };
}

function formatMessage(message: ChatMessage, recruiterId: string): InchatMessage {
  return {
    id: message.id,
    threadId: message.conversationId,
    role: message.senderId === recruiterId ? 'recruiter' : 'applicant',
    body: message.body,
    timeLabel: formatTime(message.createdAt),
    createdAtIso: message.createdAt,
    scamAnalysis: message.scamAnalysis,
  };
}

function appendUnique(messages: InchatMessage[], message: InchatMessage): InchatMessage[] {
  if (messages.some((entry) => entry.id === message.id)) return messages;
  return [...messages, message].sort((a, b) =>
    (a.createdAtIso || '').localeCompare(b.createdAtIso || '')
  );
}

async function loadPeerMetaForConversations(
  token: string,
  conversations: ChatConversation[]
): Promise<Record<string, PeerMeta>> {
  const settled = await Promise.allSettled(
    conversations.map(async (conversation) => {
      const application = await getApplicationById(token, conversation.applicationId);

      // Recruiter inbox shows the applicant; jobseeker would see company.
      const name =
        conversation.myRole === 'jobseeker'
          ? application.companyName || 'Company'
          : application.applicantName || 'Applicant';

      const subtitle =
        conversation.myRole === 'jobseeker'
          ? application.jobTitle || 'Job conversation'
          : application.jobTitle
            ? `Applied · ${application.jobTitle}`
            : `Application · ${conversation.applicationId.slice(-6)}`;

      return [
        conversation.id,
        {
          name,
          initials: initialsFromName(name),
          subtitle,
        } satisfies PeerMeta,
      ] as const;
    })
  );

  const next: Record<string, PeerMeta> = {};
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      const [conversationId, meta] = result.value;
      next[conversationId] = meta;
    }
  }
  return next;
}

export function useInchat(): InchatContextValue {
  const context = useContext(InchatContext);
  if (!context) {
    throw new Error('useInchat must be used within InchatProvider');
  }
  return context;
}

export function InchatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [peerByConversationId, setPeerByConversationId] = useState<Record<string, PeerMeta>>(
    {}
  );
  const [messagesByThread, setMessagesByThread] = useState<Record<string, InchatMessage[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const refreshConversations = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setLoaded(true);
      return;
    }

    try {
      setError(null);
      const items = await listChatConversations(token);
      setConversations(items);
      setPeerByConversationId(await loadPeerMetaForConversations(token, items));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Could not load conversations.'
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      queueMicrotask(() => {
        setError('Your session has expired. Please sign in again.');
        setLoaded(true);
      });
      return;
    }

    listChatConversations(token)
      .then(async (items) => {
        setError(null);
        setConversations(items);
        setPeerByConversationId(await loadPeerMetaForConversations(token, items));
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error ? requestError.message : 'Could not load conversations.'
        );
      })
      .finally(() => setLoaded(true));
  }, [refreshConversations]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const socket = io(getChatManagementBaseUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('message:new', ({ chatMessage }: { chatMessage?: ChatMessage }) => {
      if (!chatMessage) return;
      const conversation = conversations.find((entry) => entry.id === chatMessage.conversationId);
      if (!conversation) return;

      const mapped = formatMessage(chatMessage, conversation.recruiterId);
      setMessagesByThread((previous) => ({
        ...previous,
        [mapped.threadId]: appendUnique(previous[mapped.threadId] ?? [], mapped),
      }));
      void refreshConversations();
    });

    socket.on('connect_error', (socketError) => {
      console.error('InChat socket connection failed:', socketError.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversations, refreshConversations]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      const token = getStoredToken();
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!token || !conversation) return;

      socketRef.current?.emit('conversation:join', { conversationId: threadId });

      try {
        const messages = await listConversationMessages(token, threadId);
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: messages.map((message) =>
            formatMessage(message, conversation.recruiterId)
          ),
        }));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Could not load messages.');
      }
    },
    [conversations]
  );

  const appendRecruiterMessage = useCallback(
    async (threadId: string, body: string) => {
      const token = getStoredToken();
      const conversation = conversations.find((entry) => entry.id === threadId);
      const trimmed = body.trim();
      if (!token || !conversation || !trimmed) return;

      const sent = await sendConversationMessage(token, threadId, trimmed);
      const mapped = formatMessage(sent, conversation.recruiterId);
      setMessagesByThread((previous) => ({
        ...previous,
        [threadId]: appendUnique(previous[threadId] ?? [], mapped),
      }));
      await refreshConversations();
    },
    [conversations, refreshConversations]
  );

  const getCombinedMessages = useCallback(
    (threadId: string) => messagesByThread[threadId] ?? [],
    [messagesByThread]
  );

  const threadsForList = useMemo(
    () => conversations.map((conversation) => formatThread(conversation, peerByConversationId)),
    [conversations, peerByConversationId]
  );

  const value = useMemo(
    () => ({
      loaded,
      error,
      threadsForList,
      appendRecruiterMessage,
      getCombinedMessages,
      loadMessages,
    }),
    [loaded, error, threadsForList, appendRecruiterMessage, getCombinedMessages, loadMessages]
  );

  return <InchatContext.Provider value={value}>{children}</InchatContext.Provider>;
}
