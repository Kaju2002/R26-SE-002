import { PROFILE } from '../../data/profile';
import { PROFILE_DETAILS } from '../../data/profileDetails';

export function getProfileCompletionPercent(): number {
  let score = 0;
  if (PROFILE.avatar?.trim()) score += 20;
  if ((PROFILE.headline?.trim().length ?? 0) > 24) score += 25;
  if (PROFILE_DETAILS.skills.length >= 3) score += 25;
  if (PROFILE_DETAILS.cvFiles.length > 0) score += 20;
  if ((PROFILE.location?.trim().length ?? 0) > 3) score += 10;
  return Math.min(100, score);
}
