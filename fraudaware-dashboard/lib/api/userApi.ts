import { authHeaders, getUserManagementBaseUrl } from './apiConfig';

type PublicProfileResponse = {
  success: boolean;
  message: string;
  recruiter: {
    id: string;
    fullName: string;
    avatar?: string;
  };
};

/**
 * Public profile endpoint (named "recruiter" in API) — works for any user id.
 * Used here to load an applicant's avatar for InChat.
 */
export async function getPublicUserAvatar(
  token: string,
  userId: string
): Promise<string | undefined> {
  const response = await fetch(
    `${getUserManagementBaseUrl()}/api/profile/public/${encodeURIComponent(userId)}`,
    {
      method: 'GET',
      headers: authHeaders(token),
      cache: 'no-store',
    }
  );

  if (!response.ok) return undefined;

  let data: PublicProfileResponse;
  try {
    data = (await response.json()) as PublicProfileResponse;
  } catch {
    return undefined;
  }

  const avatar = data.recruiter?.avatar?.trim();
  return avatar || undefined;
}
