import { authHeaders, getChatManagementBaseUrl } from './apiConfig';
import { appendDocumentField } from '../utils/formDataHelpers';

export type ChatScamAnalysis = {
  status: 'not_checked' | 'pending' | 'safe' | 'flagged' | 'error';
  isScam: boolean;
  score: number | null;
  tactics: string[];
  analyzedAt: string | null;
};

export type ChatAttachment = {
  url: string;
  publicId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  body: string;
  attachments: ChatAttachment[];
  status: 'sent' | 'delivered' | 'read';
  deliveredAt: string | null;
  readAt: string | null;
  scamAnalysis: ChatScamAnalysis;
  deletedForEveryone?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
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
  blockedBy?: string | null;
  /** True when the current user is the one who blocked (WhatsApp-style). */
  iBlocked?: boolean;
  /** True when the current user saved this conversation. */
  saved?: boolean;
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
  const response = await fetch(`${getChatManagementBaseUrl()}/api/chat/conversations?limit=50`, {
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

export type ChatImageUpload = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

/** Upload and send one image, with an optional text caption. */
export async function sendConversationImageMessage(
  token: string,
  conversationId: string,
  image: ChatImageUpload,
  body = ''
): Promise<ChatMessage> {
  const form = new FormData();
  form.append('image', {
    uri: image.uri,
    name: image.fileName || 'chat-image.jpg',
    type: image.mimeType || 'image/jpeg',
  } as unknown as Blob);
  if (body.trim()) form.append('body', body.trim());

  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: form,
    }
  );

  return (await parseJson<SendMessageResponse>(response)).chatMessage;
}

export type ChatDocumentUpload = {
  uri: string;
  fileName: string;
  mimeType: string;
};

/** Upload and send one PDF, DOC, or DOCX, with an optional caption. */
export async function sendConversationDocumentMessage(
  token: string,
  conversationId: string,
  document: ChatDocumentUpload,
  body = ''
): Promise<ChatMessage> {
  const form = new FormData();
  appendDocumentField(
    form,
    'document',
    document.uri,
    document.fileName,
    document.mimeType
  );
  if (body.trim()) form.append('body', body.trim());

  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: form,
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

export type DeleteMessageMode = 'me' | 'everyone';

type DeleteMessageResponse = {
  success: boolean;
  message: string;
  mode: DeleteMessageMode;
  conversationId: string;
  messageId?: string;
  chatMessage?: ChatMessage;
};

/** Delete a message for yourself only, or for everyone (sender only). */
export async function deleteConversationMessage(
  token: string,
  conversationId: string,
  messageId: string,
  mode: DeleteMessageMode
): Promise<DeleteMessageResponse> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/messages/${messageId}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode }),
    }
  );

  return parseJson<DeleteMessageResponse>(response);
}

type ClearConversationResponse = {
  success: boolean;
  message: string;
  mode: 'me';
  conversationId: string;
  clearedAt: string;
  clearedCount: number;
  myUnread: number;
};

/** Clear all chat for the caller only (peer unchanged). */
export async function clearConversation(
  token: string,
  conversationId: string
): Promise<ClearConversationResponse> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/clear`,
    {
      method: 'POST',
      headers: authHeaders(token),
    }
  );

  return parseJson<ClearConversationResponse>(response);
}

export type ConversationStatus = 'active' | 'archived' | 'blocked';

type UpdateConversationStatusResponse = {
  success: boolean;
  message: string;
  conversation: ChatConversation;
};

/** Archive, unarchive, block, or unblock a conversation (participants only). */
export async function updateConversationStatus(
  token: string,
  conversationId: string,
  status: ConversationStatus
): Promise<ChatConversation> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/status`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    }
  );

  return (await parseJson<UpdateConversationStatusResponse>(response)).conversation;
}

/** Save or unsave a conversation for the logged-in participant. */
export async function updateConversationSaved(
  token: string,
  conversationId: string,
  saved: boolean
): Promise<ChatConversation> {
  const response = await fetch(
    `${getChatManagementBaseUrl()}/api/chat/conversations/${conversationId}/saved`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ saved }),
    }
  );

  return (await parseJson<UpdateConversationStatusResponse>(response)).conversation;
}
