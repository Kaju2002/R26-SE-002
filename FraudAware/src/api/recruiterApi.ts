import { authHeaders, getUserManagementBaseUrl } from './apiConfig';
import type { PublicRecruiterProfile } from '../types/recruiter';

export type GetPublicRecruiterResponse = {
  success: boolean;
  message: string;
  recruiter: PublicRecruiterProfile;
};

async function parseError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
  } catch {
    // ignore
  }
  throw new Error(message);
}

export async function getPublicRecruiterProfile(
  userId: string,
  token: string
): Promise<GetPublicRecruiterResponse> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/public/${encodeURIComponent(userId)}`,
    { headers: authHeaders(token) }
  );

  if (!response.ok) {
    await parseError(response, 'Failed to fetch recruiter profile');
  }

  return response.json();
}
