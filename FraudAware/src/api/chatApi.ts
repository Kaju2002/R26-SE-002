import { authHeaders, getChatManagementBaseUrl } from './apiConfig';

export type ChatScamAnalysis = {
  status: 'not_checked' | 'pending' | 'safe' | 'flagged' | 'error';
  isScam: boolean;
  score: number | null;
  tactics: string[];
  analyzedAt: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  body: string;
  attachments: unknown[];
  status: 'sent' | 'delivered' | 'read';
  deliveredAt: string | null;
  readAt: string | null;
  scamAnalysis: ChatScamAnalysis;
  createdAt: string;
  updatedAt: string;
};

export type ChatConversation = {
  id: string;
  recruiterId: string;
  jobseekerId: string;
  applicationId: string;
  jobId: string;
  status: 'active' | 'archived' | 'blocked';
  startedBy: 'recruiter' | 'jobseeker' | 'system';
  lastMessage: {
    messageId: string | null;
    senderId: string | null;
    preview: string;
    messageType: string;
    sentAt: string | null;
  };
  unreadCounts: { recruiter: number; jobseeker: number };
  myRole: 'recruiter' | 'jobseeker';
  myUnread: number;
  peerId: string;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ConversationsResponse = {
  success: boolean;
  conversations: ChatConversation[];
  pagination: Pagination;
};

type MessagesResponse = {
  success: boolean;
  conversationId: string;
  messages: ChatMessage[];
  pagination: Pagination;
};

type SendMessageResponse = {
  success: boolean;
  chatMessage: ChatMessage;
};

type CreateConversationResponse = {
  success: boolean;
  message: string;
  conversation: ChatConversation;
};

async function parseJson<T>(response: Response): Promise<T> {
  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message =
      typeof data.message === 'string' ? data.message : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export async function listChatConversations(token: string): Promise<ChatConversation[]> {
  const response = await fetch(`${getChatManagementBaseUrl()}/api/chat/conversations`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return (await parseJson<ConversationsResponse>(response)).conversations;
}

export async function createChatConversation(
  token: string,
  applicationId: string
): Promise<ChatConversation> {
  const response = await fetch(`${getChatManagementBaseUrl()}/api/chat/conversations`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ applicationId }),
  });

  return (await parseJson<CreateConversationResponse>(response)).conversation;
}

export async function listConversationMessages(
  token: string,
  conversationId: string
): Promise<ChatMessage[]> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/messages?limit=100`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  return (await parseJson<MessagesResponse>(response)).messages;
}

export async function sendConversationMessage(
  token: string,
  conversationId: string,
  body: string
): Promise<ChatMessage> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    }
  );

  return (await parseJson<SendMessageResponse>(response)).chatMessage;
}

/** Clear unread badge for the logged-in participant. */
export async function markConversationRead(
  token: string,
  conversationId: string
): Promise<void> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/read`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
    }
  );

  await parseJson<{ success: boolean; message: string }>(response);
}
