import { authHeaders, getEmailManagementBaseUrl } from './apiConfig';

export type EmailStatus = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
};

export type EmailParticipant = {
  email: string | null;
  name: string | null;
};

export type EmailFolder = {
  key: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | string;
  id: string | null;
  name: string;
  totalCount: number | null;
  unreadCount: number | null;
};

export type EmailAttachment = {
  id: string | null;
  filename: string;
  contentType: string | null;
  size: number | null;
};

export type EmailMessageSummary = {
  id: string;
  subject: string;
  snippet: string;
  from: EmailParticipant[];
  to: EmailParticipant[];
  date: number | null;
  unread: boolean;
  starred: boolean;
  hasAttachments: boolean;
};

export type EmailMessageDetail = EmailMessageSummary & {
  body: string;
  cc: EmailParticipant[];
  bcc: EmailParticipant[];
  folders: string[];
  attachments: EmailAttachment[];
};

export type SendEmailPayload = {
  to: string;
  subject: string;
  body: string;
  applicationId?: string;
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

export async function getEmailStatus(token: string): Promise<EmailStatus> {
  const response = await fetch(`${getEmailManagementBaseUrl()}/api/email/status`, {
    method: 'GET',
    headers: authHeaders(token),
    cache: 'no-store',
  });

  return parseJson<EmailStatus>(response);
}

export async function getEmailConnectUrl(
  token: string,
  provider: 'google' | 'microsoft',
  returnTo: string
): Promise<string> {
  const params = new URLSearchParams({
    provider,
    returnTo,
  });
  const response = await fetch(
    `${getEmailManagementBaseUrl()}/api/email/connect?${params.toString()}`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  const data = await parseJson<{ authUrl: string }>(response);
  return data.authUrl;
}

export async function listEmailFolders(token: string): Promise<EmailFolder[]> {
  const response = await fetch(`${getEmailManagementBaseUrl()}/api/email/folders`, {
    method: 'GET',
    headers: authHeaders(token),
    cache: 'no-store',
  });

  const data = await parseJson<{ folders: EmailFolder[] }>(response);
  return data.folders ?? [];
}

export async function listEmailMessages(
  token: string,
  options: {
    folderKey?: string;
    folderId?: string;
    q?: string;
    limit?: number;
    pageToken?: string;
  } = {}
): Promise<{ messages: EmailMessageSummary[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (options.folderKey) params.set('folderKey', options.folderKey);
  if (options.folderId) params.set('folder', options.folderId);
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.pageToken) params.set('pageToken', options.pageToken);

  const query = params.toString();
  const response = await fetch(
    `${getEmailManagementBaseUrl()}/api/email/messages${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  const data = await parseJson<{
    messages: EmailMessageSummary[];
    nextCursor: string | null;
  }>(response);

  return {
    messages: data.messages ?? [],
    nextCursor: data.nextCursor ?? null,
  };
}

export async function getEmailMessage(
  token: string,
  messageId: string
): Promise<EmailMessageDetail> {
  const response = await fetch(
    `${getEmailManagementBaseUrl()}/api/email/messages/${encodeURIComponent(messageId)}`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  const data = await parseJson<{ message: EmailMessageDetail }>(response);
  return data.message;
}

export async function sendApplicantEmail(
  token: string,
  payload: SendEmailPayload
): Promise<void> {
  const response = await fetch(`${getEmailManagementBaseUrl()}/api/email/send`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  await parseJson<{ success: boolean }>(response);
}

export async function disconnectEmail(token: string): Promise<void> {
  const response = await fetch(`${getEmailManagementBaseUrl()}/api/email/disconnect`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  await parseJson<{ success: boolean }>(response);
}
