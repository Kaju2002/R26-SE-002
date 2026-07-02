import type { ProfileDetailsData, UserProfile } from '../types/profile';

export function getProfileCompletionPercent(
  profile: UserProfile | null,
  details: ProfileDetailsData
): number {
  let score = 0;
  if (profile?.avatar?.trim()) score += 20;
  if ((profile?.headline?.trim().length ?? 0) > 24) score += 25;
  if (details.skills.length >= 3) score += 25;
  if (details.cvFiles.length > 0) score += 20;
  if ((profile?.location?.trim().length ?? 0) > 3) score += 10;
  return Math.min(100, score);
}
