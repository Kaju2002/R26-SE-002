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
  clearConversation as clearConversationApi,
  deleteConversationMessage,
  listChatConversations,
  listConversationMessages,
  markConversationRead,
  sendConversationMessage,
  updateConversationStatus as updateConversationStatusApi,
  type ChatConversation,
  type ChatMessage,
  type ConversationStatus,
  type DeleteMessageMode,
} from '@/lib/api/chatApi';
import { getChatManagementBaseUrl } from '@/lib/api/apiConfig';
import { getApplicationById } from '@/lib/api/jobApi';
import { getPublicUserAvatar } from '@/lib/api/userApi';
import { getStoredToken, getStoredUser } from '@/lib/auth/session';
import type { InchatMessage, InchatThread } from '@/lib/inchat/types';

type PeerMeta = {
  name: string;
  initials: string;
  subtitle: string;
  avatarUrl?: string;
};

export type PeerPresence = {
  isOnline: boolean;
  lastSeenAt: string | null;
};

type InchatContextValue = {
  loaded: boolean;
  error: string | null;
  threadsForList: InchatThread[];
  appendRecruiterMessage: (threadId: string, body: string) => Promise<void>;
  deleteMessage: (
    threadId: string,
    messageId: string,
    mode: DeleteMessageMode
  ) => Promise<void>;
  clearConversation: (threadId: string) => Promise<void>;
  setConversationStatus: (threadId: string, status: ConversationStatus) => Promise<void>;
  getCombinedMessages: (threadId: string) => InchatMessage[];
  loadMessages: (threadId: string) => Promise<void>;
  leaveThread: (threadId: string) => void;
  isPeerTyping: (threadId: string) => boolean;
  getPeerPresence: (threadId: string) => PeerPresence;
  setTyping: (threadId: string, isTyping: boolean) => void;
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
    avatarUrl: peer?.avatarUrl,
    lastMessagePreview: conversation.lastMessage?.preview || 'No messages yet',
    timestampLabel: formatTime(conversation.lastMessage?.sentAt || conversation.updatedAt),
    unreadCount: conversation.myUnread || 0,
    filterTags:
      conversation.status === 'archived'
        ? ['archived']
        : conversation.myUnread > 0
          ? ['focused', 'jobs', 'unread']
          : ['focused', 'jobs'],
    status: conversation.status,
    blockedBy: conversation.blockedBy ?? null,
    iBlocked: Boolean(conversation.iBlocked),
  };
}

function formatMessage(message: ChatMessage, recruiterId: string): InchatMessage {
  const deletedForEveryone = Boolean(message.deletedForEveryone);
  return {
    id: message.id,
    threadId: message.conversationId,
    role: message.senderId === recruiterId ? 'recruiter' : 'applicant',
    body: deletedForEveryone ? 'This message was deleted' : message.body,
    timeLabel: formatTime(message.createdAt),
    createdAtIso: message.createdAt,
    status: message.status,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    unsent: deletedForEveryone,
    deletedForEveryone,
    scamAnalysis: deletedForEveryone ? undefined : message.scamAnalysis,
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

      const avatarUrl =
        conversation.myRole === 'jobseeker'
          ? application.companyLogo || undefined
          : await getPublicUserAvatar(token, application.applicantId);

      return [
        conversation.id,
        {
          name,
          initials: initialsFromName(name),
          subtitle,
          avatarUrl,
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
  const [typingByThread, setTypingByThread] = useState<Record<string, boolean>>({});
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PeerPresence>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const conversationsRef = useRef(conversations);
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeThreadRef = useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

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
      const conversation = conversationsRef.current.find(
        (entry) => entry.id === chatMessage.conversationId
      );
      if (!conversation) {
        void refreshConversations();
        return;
      }

      const mapped = formatMessage(chatMessage, conversation.recruiterId);
      setMessagesByThread((previous) => ({
        ...previous,
        [mapped.threadId]: appendUnique(previous[mapped.threadId] ?? [], mapped),
      }));

      if (chatMessage.senderId !== conversation.recruiterId) {
        setTypingByThread((previous) => ({
          ...previous,
          [chatMessage.conversationId]: false,
        }));
        if (activeThreadRef.current === chatMessage.conversationId) {
          void markConversationRead(token, chatMessage.conversationId);
          setConversations((previous) =>
            previous.map((entry) =>
              entry.id === chatMessage.conversationId ? { ...entry, myUnread: 0 } : entry
            )
          );
        }
      }

      void refreshConversations();
    });

    socket.on(
      'conversation:joined',
      ({
        peerPresence,
      }: {
        conversationId?: string;
        peerPresence?: { userId?: string; isOnline?: boolean; lastSeenAt?: string | null };
      }) => {
        if (!peerPresence?.userId) return;
        setPresenceByUserId((previous) => ({
          ...previous,
          [peerPresence.userId as string]: {
            isOnline: Boolean(peerPresence.isOnline),
            lastSeenAt: peerPresence.lastSeenAt ?? null,
          },
        }));
      }
    );

    socket.on(
      'presence:update',
      ({
        userId,
        isOnline,
        lastSeenAt,
      }: {
        userId?: string;
        isOnline?: boolean;
        lastSeenAt?: string | null;
      }) => {
        if (!userId) return;
        setPresenceByUserId((previous) => ({
          ...previous,
          [userId]: { isOnline: Boolean(isOnline), lastSeenAt: lastSeenAt ?? null },
        }));
      }
    );

    socket.on(
      'messages:status',
      ({
        conversationId,
        readerId,
        recipientId,
        status,
        readAt,
        deliveredAt,
      }: {
        conversationId?: string;
        readerId?: string;
        recipientId?: string;
        status?: 'delivered' | 'read';
        readAt?: string | null;
        deliveredAt?: string | null;
      }) => {
        if (!conversationId || !status) return;
        const conversation = conversationsRef.current.find((entry) => entry.id === conversationId);
        if (!conversation) return;
        const peerActorId = status === 'read' ? readerId : recipientId;
        if (!peerActorId || String(peerActorId) === String(conversation.recruiterId)) return;
        setMessagesByThread((previous) => ({
          ...previous,
          [conversationId]: (previous[conversationId] ?? []).map((message) =>
            message.role === 'recruiter' && message.status !== 'read'
              ? {
                  ...message,
                  status,
                  readAt: status === 'read' ? readAt ?? null : message.readAt,
                  deliveredAt:
                    status === 'delivered'
                      ? deliveredAt ?? null
                      : message.deliveredAt ?? readAt ?? null,
                }
              : message
          ),
        }));
      }
    );

    socket.on(
      'message:deleted',
      ({
        conversationId,
        messageId,
        mode,
        chatMessage,
      }: {
        conversationId?: string;
        messageId?: string;
        mode?: DeleteMessageMode;
        chatMessage?: ChatMessage;
      }) => {
        if (!conversationId || !messageId || !mode) return;
        const conversation = conversationsRef.current.find((entry) => entry.id === conversationId);

        if (mode === 'me') {
          setMessagesByThread((previous) => ({
            ...previous,
            [conversationId]: (previous[conversationId] ?? []).filter(
              (message) => message.id !== messageId
            ),
          }));
        } else if (chatMessage && conversation) {
          const mapped = formatMessage(chatMessage, conversation.recruiterId);
          setMessagesByThread((previous) => ({
            ...previous,
            [conversationId]: (previous[conversationId] ?? []).map((message) =>
              message.id === messageId ? mapped : message
            ),
          }));
        } else {
          setMessagesByThread((previous) => ({
            ...previous,
            [conversationId]: (previous[conversationId] ?? []).map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    body: 'This message was deleted',
                    unsent: true,
                    deletedForEveryone: true,
                    scamAnalysis: undefined,
                  }
                : message
            ),
          }));
        }

        void refreshConversations();
      }
    );

    socket.on(
      'conversation:cleared',
      ({ conversationId }: { conversationId?: string }) => {
        if (!conversationId) return;
        setMessagesByThread((previous) => ({
          ...previous,
          [conversationId]: [],
        }));
        setConversations((previous) =>
          previous.map((entry) =>
            entry.id === conversationId
              ? {
                  ...entry,
                  myUnread: 0,
                  lastMessage: {
                    messageId: null,
                    senderId: null,
                    preview: '',
                    messageType: 'text',
                    sentAt: null,
                  },
                }
              : entry
          )
        );
        void refreshConversations();
      }
    );

    socket.on(
      'conversation:status',
      ({
        conversationId,
        status,
        blockedBy,
      }: {
        conversationId?: string;
        status?: ChatConversation['status'];
        blockedBy?: string | null;
      }) => {
        if (!conversationId || (status !== 'active' && status !== 'blocked' && status !== 'archived')) {
          return;
        }
        const myId = getStoredUser()?.id;
        setConversations((previous) =>
          previous.map((entry) => {
            if (entry.id !== conversationId) return entry;
            const nextBlockedBy =
              status === 'blocked'
                ? blockedBy !== undefined
                  ? blockedBy
                  : entry.blockedBy ?? null
                : null;
            const iBlocked =
              status === 'blocked' &&
              (nextBlockedBy
                ? Boolean(myId && nextBlockedBy === String(myId))
                : true);
            return {
              ...entry,
              status,
              blockedBy: nextBlockedBy,
              iBlocked,
            };
          })
        );
      }
    );

    socket.on(
      'typing:update',
      ({
        conversationId,
        userId,
        isTyping,
      }: {
        conversationId?: string;
        userId?: string;
        isTyping?: boolean;
      }) => {
        if (!conversationId || !userId) return;
        const conversation = conversationsRef.current.find(
          (entry) => entry.id === conversationId
        );
        if (!conversation) return;
        // Ignore our own typing echoes if any.
        if (String(userId) === String(conversation.recruiterId)) return;

        setTypingByThread((previous) => ({
          ...previous,
          [conversationId]: Boolean(isTyping),
        }));

        const existingTimeout = typingTimeoutRef.current[conversationId];
        if (existingTimeout) clearTimeout(existingTimeout);

        if (isTyping) {
          typingTimeoutRef.current[conversationId] = setTimeout(() => {
            setTypingByThread((previous) => ({
              ...previous,
              [conversationId]: false,
            }));
          }, 4000);
        }
      }
    );

    socket.on('connect_error', (socketError) => {
      console.error('InChat socket connection failed:', socketError.message);
    });

    return () => {
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
      typingTimeoutRef.current = {};
      socket.disconnect();
      socketRef.current = null;
      activeThreadRef.current = null;
    };
  }, [refreshConversations]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      const token = getStoredToken();
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!token || !conversation) return;

      socketRef.current?.emit('conversation:join', { conversationId: threadId });
      activeThreadRef.current = threadId;

      try {
        const messages = await listConversationMessages(token, threadId);
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: messages.map((message) =>
            formatMessage(message, conversation.recruiterId)
          ),
        }));

        await markConversationRead(token, threadId);
        if (conversation.myUnread > 0) {
          setConversations((previous) =>
            previous.map((entry) =>
              entry.id === threadId
                ? {
                    ...entry,
                    myUnread: 0,
                    unreadCounts: {
                      ...entry.unreadCounts,
                      [entry.myRole]: 0,
                    },
                  }
                : entry
            )
          );
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Could not load messages.');
      }
    },
    [conversations]
  );

  const leaveThread = useCallback((threadId: string) => {
    socketRef.current?.emit('conversation:leave', { conversationId: threadId });
    if (activeThreadRef.current === threadId) activeThreadRef.current = null;
  }, []);

  const appendRecruiterMessage = useCallback(
    async (threadId: string, body: string) => {
      const token = getStoredToken();
      const conversation = conversations.find((entry) => entry.id === threadId);
      const trimmed = body.trim();
      if (!token || !conversation || !trimmed) return;

      socketRef.current?.emit('typing:stop', { conversationId: threadId });
      setTypingByThread((previous) => ({ ...previous, [threadId]: false }));

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

  const deleteMessage = useCallback(
    async (threadId: string, messageId: string, mode: DeleteMessageMode) => {
      const token = getStoredToken();
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!token || !conversation) return;

      const result = await deleteConversationMessage(token, threadId, messageId, mode);

      if (mode === 'me') {
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: (previous[threadId] ?? []).filter((message) => message.id !== messageId),
        }));
      } else if (result.chatMessage) {
        const mapped = formatMessage(result.chatMessage, conversation.recruiterId);
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: (previous[threadId] ?? []).map((message) =>
            message.id === messageId ? mapped : message
          ),
        }));
      } else {
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: (previous[threadId] ?? []).map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  body: 'This message was deleted',
                  unsent: true,
                  deletedForEveryone: true,
                  scamAnalysis: undefined,
                }
              : message
          ),
        }));
      }

      await refreshConversations();
    },
    [conversations, refreshConversations]
  );

  const clearConversation = useCallback(
    async (threadId: string) => {
      const token = getStoredToken();
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!token || !conversation) return;

      await clearConversationApi(token, threadId);
      setMessagesByThread((previous) => ({
        ...previous,
        [threadId]: [],
      }));
      setConversations((previous) =>
        previous.map((entry) =>
          entry.id === threadId
            ? {
                ...entry,
                myUnread: 0,
                lastMessage: {
                  messageId: null,
                  senderId: null,
                  preview: '',
                  messageType: 'text',
                  sentAt: null,
                },
              }
            : entry
        )
      );
      await refreshConversations();
    },
    [conversations, refreshConversations]
  );

  const setConversationStatus = useCallback(
    async (threadId: string, status: ConversationStatus) => {
      const token = getStoredToken();
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!token || !conversation) return;

      const updated = await updateConversationStatusApi(token, threadId, status);
      setConversations((previous) =>
        previous.map((entry) =>
          entry.id === threadId
            ? {
                ...entry,
                status: updated.status,
                blockedBy: updated.blockedBy ?? null,
                iBlocked: Boolean(updated.iBlocked),
              }
            : entry
        )
      );
    },
    [conversations]
  );

  const getCombinedMessages = useCallback(
    (threadId: string) => messagesByThread[threadId] ?? [],
    [messagesByThread]
  );

  const isPeerTyping = useCallback(
    (threadId: string) => Boolean(typingByThread[threadId]),
    [typingByThread]
  );

  const getPeerPresence = useCallback(
    (threadId: string): PeerPresence => {
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!conversation) return { isOnline: false, lastSeenAt: null };
      return presenceByUserId[conversation.peerId] ?? { isOnline: false, lastSeenAt: null };
    },
    [conversations, presenceByUserId]
  );

  const setTyping = useCallback((threadId: string, isTyping: boolean) => {
    if (!threadId || !socketRef.current) return;
    socketRef.current.emit(isTyping ? 'typing:start' : 'typing:stop', {
      conversationId: threadId,
    });
  }, []);

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
      deleteMessage,
      clearConversation,
      setConversationStatus,
      getCombinedMessages,
      loadMessages,
      leaveThread,
      isPeerTyping,
      getPeerPresence,
      setTyping,
    }),
    [
      loaded,
      error,
      threadsForList,
      appendRecruiterMessage,
      deleteMessage,
      clearConversation,
      setConversationStatus,
      getCombinedMessages,
      loadMessages,
      leaveThread,
      isPeerTyping,
      getPeerPresence,
      setTyping,
    ]
  );

  return <InchatContext.Provider value={value}>{children}</InchatContext.Provider>;
}
