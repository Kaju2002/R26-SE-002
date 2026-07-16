import React, {
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
} from '../api/chatApi';
import { getChatManagementBaseUrl } from '../api/apiConfig';
import { getApplicationById } from '../api/jobApi';
import { useUser } from './UserContext';
import type { InchatMessage } from '../../data/inchatMessages';
import type { InchatThread } from '../../data/inchatThreads';

type PeerMeta = {
  name: string;
  initials: string;
  subtitle: string;
};

type InchatContextValue = {
  loaded: boolean;
  error: string | null;
  threadsForList: InchatThread[];
  getThreadById: (threadId: string) => InchatThread | undefined;
  appendUserMessage: (threadId: string, body: string) => Promise<void>;
  editUserMessageState: (
    threadId: string,
    messageId: string,
    mode: 'delete' | 'unsend'
  ) => Promise<void>;
  getCombinedMessages: (threadId: string) => InchatMessage[];
  loadMessages: (threadId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
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
  return name.slice(0, 2).toUpperCase() || '?';
}

function formatThread(
  conversation: ChatConversation,
  peerByConversationId: Record<string, PeerMeta>
): InchatThread {
  const peer = peerByConversationId[conversation.id];
  return {
    id: conversation.id,
    participantName: peer?.name || (conversation.myRole === 'jobseeker' ? 'Recruiter' : 'Applicant'),
    subtitle: peer?.subtitle || `Application · ${conversation.applicationId.slice(-6)}`,
    avatarKind: 'person',
    initials: peer?.initials || '?',
    lastMessagePreview: conversation.lastMessage?.preview || 'No messages yet',
    timestampLabel: formatTime(conversation.lastMessage?.sentAt || conversation.updatedAt),
    unreadCount: conversation.myUnread || 0,
    filterTags: conversation.myUnread > 0 ? ['focused', 'jobs', 'unread'] : ['focused', 'jobs'],
  };
}

function formatMessage(message: ChatMessage, currentUserId: string): InchatMessage {
  return {
    id: message.id,
    threadId: message.conversationId,
    role: message.senderId === currentUserId ? 'user' : 'contact',
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
  const ctx = useContext(InchatContext);
  if (!ctx) {
    throw new Error('useInchat must be used within InchatProvider');
  }
  return ctx;
}

export function InchatProvider({ children }: { children: ReactNode }) {
  const { token, user } = useUser();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [peerByConversationId, setPeerByConversationId] = useState<Record<string, PeerMeta>>({});
  const [messagesByThread, setMessagesByThread] = useState<Record<string, InchatMessage[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const refreshConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      setPeerByConversationId({});
      setError(null);
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
  }, [token]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!token || !user?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(getChatManagementBaseUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('message:new', ({ chatMessage }: { chatMessage?: ChatMessage }) => {
      if (!chatMessage || !user?.id) return;
      const exists = conversationsRef.current.some(
        (entry) => entry.id === chatMessage.conversationId
      );
      if (!exists) {
        void refreshConversations();
        return;
      }

      const mapped = formatMessage(chatMessage, user.id);
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
  }, [token, user?.id, refreshConversations]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (!token || !user?.id) return;
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!conversation) return;

      socketRef.current?.emit('conversation:join', { conversationId: threadId });

      try {
        const messages = await listConversationMessages(token, threadId);
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: messages.map((message) => formatMessage(message, user.id)),
        }));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Could not load messages.');
      }
    },
    [conversations, token, user?.id]
  );

  const appendUserMessage = useCallback(
    async (threadId: string, body: string) => {
      if (!token || !user?.id) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

      const sent = await sendConversationMessage(token, threadId, trimmed);
      const mapped = formatMessage(sent, user.id);
      setMessagesByThread((previous) => ({
        ...previous,
        [threadId]: appendUnique(previous[threadId] ?? [], mapped),
      }));
      await refreshConversations();
    },
    [conversations, refreshConversations, token, user?.id]
  );

  const editUserMessageState = useCallback(
    async (threadId: string, messageId: string, mode: 'delete' | 'unsend') => {
      // Server unsend/delete is not implemented yet — only allow local-prefixed drafts.
      if (!messageId.startsWith('local-')) return;

      setMessagesByThread((prev) => {
        const existing = prev[threadId] ?? [];
        if (!existing.some((m) => m.id === messageId && m.role === 'user')) {
          return prev;
        }
        const updated =
          mode === 'delete'
            ? existing.filter((m) => m.id !== messageId)
            : existing.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      body: 'You unsent a message',
                      unsent: true,
                    }
                  : m
              );
        return {
          ...prev,
          [threadId]: updated,
        };
      });
    },
    []
  );

  const getCombinedMessages = useCallback(
    (threadId: string) => messagesByThread[threadId] ?? [],
    [messagesByThread]
  );

  const threadsForList = useMemo(
    () => conversations.map((conversation) => formatThread(conversation, peerByConversationId)),
    [conversations, peerByConversationId]
  );

  const getThreadById = useCallback(
    (threadId: string) => threadsForList.find((thread) => thread.id === threadId),
    [threadsForList]
  );

  const value = useMemo(
    () => ({
      loaded,
      error,
      threadsForList,
      getThreadById,
      appendUserMessage,
      editUserMessageState,
      getCombinedMessages,
      loadMessages,
      refreshConversations,
    }),
    [
      loaded,
      error,
      threadsForList,
      getThreadById,
      appendUserMessage,
      editUserMessageState,
      getCombinedMessages,
      loadMessages,
      refreshConversations,
    ]
  );

  return <InchatContext.Provider value={value}>{children}</InchatContext.Provider>;
}
