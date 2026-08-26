import { authHeaders, authHeadersMultipart, getUserManagementBaseUrl } from './apiConfig';

export type UpdateBasicProfilePayload = {
  fullName?: string;
  headline?: string;
  role?: string;
  location?: string;
  company?: {
    name?: string;
    website?: string | null;
    industry?: string | null;
    address?: string | null;
    description?: string | null;
    registrationNumber?: string | null;
  };
};

type ProfileApiResponse = {
  success: boolean;
  message: string;
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

export async function updateBasicProfile(
  token: string,
  payload: UpdateBasicProfilePayload
): Promise<ProfileApiResponse> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/basic`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseJson<ProfileApiResponse>(response);
}

export async function updateAvatar(token: string, file: File): Promise<ProfileApiResponse> {
  const form = new FormData();
  form.append('avatar', file);

  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/avatar`, {
    method: 'PATCH',
    headers: authHeadersMultipart(token),
    body: form,
  });

  return parseJson<ProfileApiResponse>(response);
}

export async function updateCompanyLogo(token: string, file: File): Promise<ProfileApiResponse> {
  const form = new FormData();
  form.append('logo', file);

  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/company/logo`, {
    method: 'PATCH',
    headers: authHeadersMultipart(token),
    body: form,
  });

  return parseJson<ProfileApiResponse>(response);
}

export type CompanyVerificationStatus = {
  success: boolean;
  isVerified: boolean;
  status: 'none' | 'pending' | 'verified' | 'rejected';
  latest: {
    id: string;
    decision: string;
    summary?: string;
    rejectionReason?: string | null;
  } | null;
};

export async function getCompanyVerificationStatus(
  token: string
): Promise<CompanyVerificationStatus> {
  const response = await fetch(`${getUserManagementBaseUrl()}/api/profile/verification`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  return parseJson<CompanyVerificationStatus>(response);
}

export async function requestCompanyVerification(
  token: string,
  options: { sync?: boolean } = {}
): Promise<{
  success: boolean;
  message: string;
  isVerified?: boolean;
}> {
  const query = options.sync ? '?sync=1' : '';
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/verification/request${query}`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sync: options.sync ? 1 : undefined }),
    }
  );
  return parseJson(response);
}
