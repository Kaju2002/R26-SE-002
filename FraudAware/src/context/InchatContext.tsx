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
  clearConversation as clearConversationApi,
  createChatConversation,
  deleteConversationMessage,
  listChatConversations,
  listConversationMessages,
  markConversationRead,
  sendConversationDocumentMessage,
  sendConversationImageMessage,
  sendConversationMessage,
  updateConversationSaved as updateConversationSavedApi,
  updateConversationStatus as updateConversationStatusApi,
  type ChatConversation,
  type ChatDocumentUpload,
  type ChatMessage,
  type ChatImageUpload,
  type ConversationStatus,
  type DeleteMessageMode,
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
  avatarKind: 'person' | 'company';
  avatarUrl?: string;
};

export type InchatBannerNotification = {
  id: string;
  threadId: string;
  senderName: string;
  body: string;
  flagged: boolean;
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
  incomingNotification: InchatBannerNotification | null;
  dismissIncomingNotification: () => void;
  getThreadById: (threadId: string) => InchatThread | undefined;
  appendUserMessage: (threadId: string, body: string) => Promise<void>;
  appendUserImageMessage: (
    threadId: string,
    image: ChatImageUpload,
    caption?: string
  ) => Promise<void>;
  appendUserDocumentMessage: (
    threadId: string,
    document: ChatDocumentUpload,
    caption?: string
  ) => Promise<void>;
  /** Delete for me (any message) or delete for everyone (own messages only). */
  deleteMessage: (
    threadId: string,
    messageId: string,
    mode: DeleteMessageMode
  ) => Promise<void>;
  /** Clear all messages in a thread for the current user only. */
  clearConversation: (threadId: string) => Promise<void>;
  /** Archive, unarchive, block, or unblock a conversation. */
  setConversationStatus: (threadId: string, status: ConversationStatus) => Promise<void>;
  /** Save or unsave a conversation for the current user. */
  setConversationSaved: (threadId: string, saved: boolean) => Promise<void>;
  getCombinedMessages: (threadId: string) => InchatMessage[];
  loadMessages: (threadId: string) => Promise<void>;
  leaveThread: (threadId: string) => void;
  refreshConversations: () => Promise<void>;
  /** Create-or-get conversation for an application, refresh inbox, return thread id. */
  startConversationFromApplication: (applicationId: string) => Promise<string>;
  /** True when the peer is currently typing in this thread. */
  isPeerTyping: (threadId: string) => boolean;
  getPeerPresence: (threadId: string) => PeerPresence;
  /** Notify the peer that this user started/stopped typing. */
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
  return name.slice(0, 2).toUpperCase() || '?';
}

function formatThread(
  conversation: ChatConversation,
  peerByConversationId: Record<string, PeerMeta>
): InchatThread {
  const peer = peerByConversationId[conversation.id];
  return {
    id: conversation.id,
    jobId: conversation.jobId,
    participantName: peer?.name || (conversation.myRole === 'jobseeker' ? 'Recruiter' : 'Applicant'),
    subtitle: peer?.subtitle || `Application · ${conversation.applicationId.slice(-6)}`,
    avatarKind: peer?.avatarKind ?? (conversation.myRole === 'jobseeker' ? 'company' : 'person'),
    initials: peer?.initials || '?',
    avatarUrl: peer?.avatarUrl,
    lastMessagePreview: (() => {
      const preview = conversation.lastMessage?.preview || 'No messages yet';
      try {
        return decodeURIComponent(preview.replace(/\+/g, ' '));
      } catch {
        return preview;
      }
    })(),
    timestampLabel: formatTime(conversation.lastMessage?.sentAt || conversation.updatedAt),
    unreadCount: conversation.myUnread || 0,
    filterTags: [
      ...(conversation.status === 'active' ? ['focused' as const] : []),
      ...(conversation.status !== 'archived' && conversation.jobId ? ['jobs' as const] : []),
      ...(conversation.status !== 'archived' && conversation.myUnread > 0
        ? ['unread' as const]
        : []),
      ...(conversation.saved ? ['saved' as const] : []),
      ...(conversation.status === 'archived' ? ['archived' as const] : []),
    ],
    status: conversation.status,
    blockedBy: conversation.blockedBy ?? null,
    iBlocked: Boolean(conversation.iBlocked),
    saved: Boolean(conversation.saved),
  };
}

function formatMessage(message: ChatMessage, currentUserId: string): InchatMessage {
  const deletedForEveryone = Boolean(message.deletedForEveryone);
  const attachments = deletedForEveryone
    ? []
    : (message.attachments ?? []).map((attachment) => {
        let fileName = attachment.fileName;
        try {
          fileName = decodeURIComponent(String(fileName || '').replace(/\+/g, ' '));
        } catch {
          /* keep original */
        }
        return { ...attachment, fileName };
      });
  return {
    id: message.id,
    threadId: message.conversationId,
    role: message.senderId === currentUserId ? 'user' : 'contact',
    body: deletedForEveryone ? 'This message was deleted' : message.body,
    messageType: deletedForEveryone ? 'system' : message.messageType,
    attachments,
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
      const isJobseeker = conversation.myRole === 'jobseeker';
      const name = isJobseeker
        ? application.companyName || 'Company'
        : application.applicantName || 'Applicant';
      const subtitle = isJobseeker
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
          // Jobseeker sees the company (logo); recruiter sees the applicant (initials).
          avatarKind: isJobseeker ? 'company' : 'person',
          avatarUrl: isJobseeker ? application.companyLogo ?? undefined : undefined,
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
  const [incomingNotification, setIncomingNotification] =
    useState<InchatBannerNotification | null>(null);
  const [typingByThread, setTypingByThread] = useState<Record<string, boolean>>({});
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PeerPresence>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const conversationsRef = useRef(conversations);
  const peerByConversationIdRef = useRef(peerByConversationId);
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeThreadRef = useRef<string | null>(null);

  useEffect(() => {
    conversationsRef.current = conversations;
    peerByConversationIdRef.current = peerByConversationId;
  }, [conversations, peerByConversationId]);

  const dismissIncomingNotification = useCallback(() => {
    setIncomingNotification(null);
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      setPeerByConversationId({});
      setIncomingNotification(null);
      setTypingByThread({});
      setPresenceByUserId({});
      activeThreadRef.current = null;
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

    socket.on('message:new', async ({ chatMessage }: { chatMessage?: ChatMessage }) => {
      if (!chatMessage || !user?.id) return;
      let conversation = conversationsRef.current.find(
        (entry) => entry.id === chatMessage.conversationId
      );

      // A recruiter may create the conversation while this app is already open.
      // Hydrate it before deciding whether to show the jobseeker notification.
      if (!conversation) {
        try {
          const items = await listChatConversations(token);
          const peers = await loadPeerMetaForConversations(token, items);
          setConversations(items);
          setPeerByConversationId(peers);
          conversation = items.find(
            (entry) => entry.id === chatMessage.conversationId
          );
          peerByConversationIdRef.current = peers;
        } catch {
          void refreshConversations();
        }
      }

      const mapped = formatMessage(chatMessage, user.id);
      setMessagesByThread((previous) => ({
        ...previous,
        [mapped.threadId]: appendUnique(previous[mapped.threadId] ?? [], mapped),
      }));

      // Incoming message means peer finished typing.
      if (chatMessage.senderId !== user.id) {
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

      const isIncomingRecruiterMessage =
        chatMessage.senderId !== user.id &&
        conversation?.myRole === 'jobseeker';
      if (isIncomingRecruiterMessage) {
        const peer = peerByConversationIdRef.current[chatMessage.conversationId];
        setIncomingNotification({
          id: chatMessage.id,
          threadId: chatMessage.conversationId,
          senderName: peer?.name || 'Recruiter',
          body: chatMessage.body,
          flagged:
            chatMessage.scamAnalysis?.status === 'flagged' ||
            chatMessage.scamAnalysis?.isScam === true,
          avatarUrl: peer?.avatarUrl,
        });
      }

      void refreshConversations();
    });

    socket.on(
      'conversation:joined',
      ({
        conversationId,
        peerPresence,
      }: {
        conversationId?: string;
        peerPresence?: { userId?: string; isOnline?: boolean; lastSeenAt?: string | null };
      }) => {
        if (!conversationId || !peerPresence?.userId) return;
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
        if (!userId || userId === user.id) return;
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
        const peerActorId = status === 'read' ? readerId : recipientId;
        if (!peerActorId || peerActorId === user.id) return;
        setMessagesByThread((previous) => ({
          ...previous,
          [conversationId]: (previous[conversationId] ?? []).map((message) =>
            message.role === 'user' && message.status !== 'read'
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

        if (mode === 'me') {
          setMessagesByThread((previous) => ({
            ...previous,
            [conversationId]: (previous[conversationId] ?? []).filter(
              (message) => message.id !== messageId
            ),
          }));
        } else if (chatMessage && user?.id) {
          const mapped = formatMessage(chatMessage, user.id);
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
                ? Boolean(user?.id && nextBlockedBy === String(user.id))
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
        if (!conversationId || !userId || !user?.id) return;
        if (userId === user.id) return;

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
  }, [token, user?.id, refreshConversations]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (!token || !user?.id) return;
      const conversation = conversations.find((entry) => entry.id === threadId);
      if (!conversation) return;

      socketRef.current?.emit('conversation:join', { conversationId: threadId });
      activeThreadRef.current = threadId;

      try {
        const messages = await listConversationMessages(token, threadId);
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: messages.map((message) => formatMessage(message, user.id)),
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
    [conversations, token, user?.id]
  );

  const leaveThread = useCallback((threadId: string) => {
    socketRef.current?.emit('conversation:leave', { conversationId: threadId });
    if (activeThreadRef.current === threadId) activeThreadRef.current = null;
  }, []);

  const appendUserMessage = useCallback(
    async (threadId: string, body: string) => {
      if (!token || !user?.id) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

      socketRef.current?.emit('typing:stop', { conversationId: threadId });
      setTypingByThread((previous) => ({ ...previous, [threadId]: false }));

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

  const appendUserImageMessage = useCallback(
    async (threadId: string, image: ChatImageUpload, caption = '') => {
      if (!token || !user?.id) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

      socketRef.current?.emit('typing:stop', { conversationId: threadId });
      setTypingByThread((previous) => ({ ...previous, [threadId]: false }));

      const sent = await sendConversationImageMessage(
        token,
        threadId,
        image,
        caption.trim()
      );
      const mapped = formatMessage(sent, user.id);
      setMessagesByThread((previous) => ({
        ...previous,
        [threadId]: appendUnique(previous[threadId] ?? [], mapped),
      }));
      await refreshConversations();
    },
    [conversations, refreshConversations, token, user?.id]
  );

  const appendUserDocumentMessage = useCallback(
    async (threadId: string, document: ChatDocumentUpload, caption = '') => {
      if (!token || !user?.id) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

      socketRef.current?.emit('typing:stop', { conversationId: threadId });
      setTypingByThread((previous) => ({ ...previous, [threadId]: false }));

      const sent = await sendConversationDocumentMessage(
        token,
        threadId,
        document,
        caption.trim()
      );
      const mapped = formatMessage(sent, user.id);
      setMessagesByThread((previous) => ({
        ...previous,
        [threadId]: appendUnique(previous[threadId] ?? [], mapped),
      }));
      await refreshConversations();
    },
    [conversations, refreshConversations, token, user?.id]
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

  const deleteMessage = useCallback(
    async (threadId: string, messageId: string, mode: DeleteMessageMode) => {
      if (!token || !user?.id) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

      const result = await deleteConversationMessage(token, threadId, messageId, mode);

      if (mode === 'me') {
        setMessagesByThread((previous) => ({
          ...previous,
          [threadId]: (previous[threadId] ?? []).filter((message) => message.id !== messageId),
        }));
      } else if (result.chatMessage) {
        const mapped = formatMessage(result.chatMessage, user.id);
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
    [conversations, refreshConversations, token, user?.id]
  );

  const clearConversation = useCallback(
    async (threadId: string) => {
      if (!token || !user?.id) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

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
    [conversations, refreshConversations, token, user?.id]
  );

  const setConversationStatus = useCallback(
    async (threadId: string, status: ConversationStatus) => {
      if (!token || !user?.id) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

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
    [conversations, token, user?.id]
  );

  const setConversationSaved = useCallback(
    async (threadId: string, saved: boolean) => {
      if (!token || !user?.id) return;
      if (!conversations.some((entry) => entry.id === threadId)) return;

      const updated = await updateConversationSavedApi(token, threadId, saved);
      setConversations((previous) =>
        previous.map((entry) =>
          entry.id === threadId ? { ...entry, saved: Boolean(updated.saved) } : entry
        )
      );
    },
    [conversations, token, user?.id]
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

  const startConversationFromApplication = useCallback(
    async (applicationId: string) => {
      if (!token) {
        throw new Error('Sign in to start a chat.');
      }
      const conversation = await createChatConversation(token, applicationId);
      await refreshConversations();
      return conversation.id;
    },
    [refreshConversations, token]
  );

  const value = useMemo(
    () => ({
      loaded,
      error,
      threadsForList,
      incomingNotification,
      dismissIncomingNotification,
      getThreadById,
      appendUserMessage,
      appendUserImageMessage,
      appendUserDocumentMessage,
      deleteMessage,
      clearConversation,
      setConversationStatus,
      setConversationSaved,
      getCombinedMessages,
      loadMessages,
      leaveThread,
      refreshConversations,
      startConversationFromApplication,
      isPeerTyping,
      getPeerPresence,
      setTyping,
    }),
    [
      loaded,
      error,
      threadsForList,
      incomingNotification,
      dismissIncomingNotification,
      getThreadById,
      appendUserMessage,
      appendUserImageMessage,
      appendUserDocumentMessage,
      deleteMessage,
      clearConversation,
      setConversationStatus,
      setConversationSaved,
      getCombinedMessages,
      loadMessages,
      leaveThread,
      refreshConversations,
      startConversationFromApplication,
      isPeerTyping,
      getPeerPresence,
      setTyping,
    ]
  );

  return <InchatContext.Provider value={value}>{children}</InchatContext.Provider>;
}
