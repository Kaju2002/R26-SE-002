import { authHeaders, getJobManagementBaseUrl } from './apiConfig';

export type TemplateCategory =
  | 'screening'
  | 'interview_invite'
  | 'reject'
  | 'offer'
  | 'custom';

export type MessageTemplate = {
  id: string;
  workspaceId: string | null;
  ownerId: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TemplateVariables = {
  name?: string;
  jobTitle?: string;
  company?: string;
};

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  screening: 'Screening',
  interview_invite: 'Interview invite',
  reject: 'Reject',
  offer: 'Offer',
  custom: 'Custom',
};

export function applyTemplateVariables(
  text: string,
  vars: TemplateVariables = {}
): string {
  const map: Record<string, string> = {
    name: vars.name?.trim() || 'there',
    jobTitle: vars.jobTitle?.trim() || 'the role',
    job: vars.jobTitle?.trim() || 'the role',
    company: vars.company?.trim() || 'our company',
  };

  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return map[key] ?? `{{${key}}}`;
  });
}

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

export async function listTemplates(
  token: string,
  params: { category?: TemplateCategory } = {}
): Promise<MessageTemplate[]> {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  const query = search.toString();
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/templates${query ? `?${query}` : ''}`,
    { headers: authHeaders(token) }
  );
  const data = await parseJson<{ templates: MessageTemplate[] }>(response);
  return data.templates || [];
}

export async function createTemplate(
  token: string,
  payload: {
    name: string;
    body: string;
    subject?: string;
    category?: TemplateCategory;
  }
): Promise<MessageTemplate> {
  const response = await fetch(`${getJobManagementBaseUrl()}/api/jobs/templates`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ template: MessageTemplate }>(response);
  return data.template;
}

export async function updateTemplate(
  token: string,
  templateId: string,
  payload: Partial<{
    name: string;
    body: string;
    subject: string;
    category: TemplateCategory;
  }>
): Promise<MessageTemplate> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/templates/${templateId}`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await parseJson<{ template: MessageTemplate }>(response);
  return data.template;
}

export async function deleteTemplate(token: string, templateId: string): Promise<void> {
  const response = await fetch(
    `${getJobManagementBaseUrl()}/api/jobs/templates/${templateId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );
  await parseJson(response);
}
