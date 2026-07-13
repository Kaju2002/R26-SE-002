/** Whether the current user can open recruiter messaging entry points for a job. */
export function canMessageRecruiter(
  postedBy: string | undefined,
  currentUserId: string | undefined | null
): boolean {
  if (!postedBy?.trim()) return false;
  if (!currentUserId) return false;
  return postedBy !== currentUserId;
}

export type RecruiterNavParams = {
  recruiterId: string;
  jobId?: string;
};
