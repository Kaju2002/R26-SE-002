import { authHeaders } from './apiConfig';
import { getAssistantMessageUrl, getAssistantSessionUrl } from '../config/assistantApi';

export type AssistantCheckSource = 'job_post' | 'company' | 'recruiter_chat';
export type AssistantCheckStatus =
  | 'missing'
  | 'running'
  | 'done'
  | 'skipped'
  | 'not_applicable'
  | 'failed';
export type AssistantRisk = 'high' | 'medium' | 'low' | 'unknown';
export type AssistantAwaiting =
  | 'menu'
  | 'input_type'
  | 'job_post'
  | 'company'
  | 'recruiter_question'
  | 'recruiter_chat'
  | 'waiting'
  | 'finished';

export type AssistantChip = { id: string; label: string };

export type AssistantCheck = {
  source: AssistantCheckSource;
  status: AssistantCheckStatus;
  risk: AssistantRisk | null;
  reasons: string[];
};

export type AssistantVerdict = {
  level: 'high_risk' | 'be_careful' | 'no_warning_signs_partial' | 'no_warning_signs';
  title: string;
  colour: 'red' | 'orange' | 'grey' | 'green';
  partial: boolean;
  note: string | null;
  not_checked: AssistantCheckSource[];
  checks: AssistantCheck[];
  disclaimer: string;
};

export type AssistantServerMessage = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
};

export type AssistantMessageResponse = {
  session_id: string;
  reply: string;
  chips: AssistantChip[];
  awaiting: AssistantAwaiting;
  checks: AssistantCheck[];
  running: boolean;
  result: AssistantVerdict | null;
};

export type AssistantSessionView = {
  session_id: string;
  awaiting: AssistantAwaiting;
  messages: AssistantServerMessage[];
  chips: AssistantChip[];
  checks: AssistantCheck[];
  running: boolean;
  result: AssistantVerdict | null;
};

export type AssistantImage = { uri: string; name?: string | null; type?: string | null };

export type AssistantMessageInput = {
  sessionId?: string | null;
  text?: string;
  chip?: string;
  image?: AssistantImage;
};

export class AssistantApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AssistantApiError';
  }
}

async function readError(response: Response): Promise<AssistantApiError> {
  let detail = '';
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') detail = body.detail;
  } catch {
    // not JSON
  }
  if (response.status === 401) {
    return new AssistantApiError('Your session has ended. Please log in again.', 401);
  }
  return new AssistantApiError(detail || `The assistant returned an error (${response.status}).`, response.status);
}

/** One user turn: text, a screenshot, a button press, or nothing (starts a conversation). */
export async function sendAssistantMessage(
  token: string,
  input: AssistantMessageInput
): Promise<AssistantMessageResponse> {
  const form = new FormData();
  if (input.sessionId) form.append('session_id', input.sessionId);
  if (input.text) form.append('text', input.text);
  if (input.chip) form.append('chip', input.chip);
  if (input.image) {
    form.append('image', {
      uri: input.image.uri,
      name: input.image.name ?? 'screenshot.jpg',
      type: input.image.type ?? 'image/jpeg',
    } as unknown as Blob);
  }

  const response = await fetch(getAssistantMessageUrl(), {
    method: 'POST',
    headers: { Accept: 'application/json', ...authHeaders(token) },
    body: form,
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as AssistantMessageResponse;
}

export async function getAssistantSession(
  token: string,
  sessionId: string
): Promise<AssistantSessionView> {
  const response = await fetch(getAssistantSessionUrl(sessionId), {
    headers: { Accept: 'application/json', ...authHeaders(token) },
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as AssistantSessionView;
}
