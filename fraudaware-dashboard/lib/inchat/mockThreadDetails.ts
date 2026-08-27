import type { InchatThreadDetails } from './types';

/**
 * @deprecated Sidebar now uses live messages via `deriveThreadDetailsFromMessages`.
 * Kept only so older imports do not break.
 */
export const MOCK_THREAD_DETAILS: Record<string, InchatThreadDetails> = {};

export function getMockThreadDetails(_threadId: string): InchatThreadDetails {
  return { media: [], attachments: [] };
}
