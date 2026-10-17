import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AssistantVerdict } from '../api/assistantApi';

/** Bump the version when the notice text changes, so everyone sees it again. */
const PRIVACY_KEY = '@fraudaware/assistant_privacy_v1';
const RECENT_KEY = '@fraudaware/assistant_recent_checks';
const MAX_RECENT = 20;
const KEEP_DAYS = 90;

export type CompanyGiven = {
  company_name?: string | null;
  website_url?: string | null;
  email?: string | null;
};

/** One finished check, kept only on this phone. No chat messages are stored. */
export type RecentCheck = {
  id: string;
  checkedAt: string;
  verdict: AssistantVerdict;
  company: CompanyGiven | null;
};

const userKey = (base: string, userId: string) => `${base}:${userId}`;

export async function hasAcceptedAssistantPrivacy(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(userKey(PRIVACY_KEY, userId))) === '1';
  } catch {
    return false;
  }
}

export async function acceptAssistantPrivacy(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(userKey(PRIVACY_KEY, userId), '1');
  } catch {
    // shown again next time
  }
}

/** The company details the user gave, from the company check of a verdict. */
export function companyGiven(verdict: AssistantVerdict): CompanyGiven | null {
  const given = verdict.checks.find((c) => c.source === 'company')?.details?.given;
  if (!given || typeof given !== 'object') return null;
  const g = given as CompanyGiven;
  return g.company_name || g.website_url || g.email ? g : null;
}

export async function getRecentChecks(userId: string): Promise<RecentCheck[]> {
  try {
    const raw = await AsyncStorage.getItem(userKey(RECENT_KEY, userId));
    const list = raw ? (JSON.parse(raw) as RecentCheck[]) : [];
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    return Array.isArray(list) ? list.filter((c) => Date.parse(c.checkedAt) >= cutoff) : [];
  } catch {
    return [];
  }
}

/** Saves a finished check; the same conversation is saved once. */
export async function saveRecentCheck(userId: string, id: string, verdict: AssistantVerdict): Promise<void> {
  try {
    const list = await getRecentChecks(userId);
    if (list.some((c) => c.id === id)) return;
    const entry: RecentCheck = {
      id,
      checkedAt: new Date().toISOString(),
      verdict,
      company: companyGiven(verdict),
    };
    const next = [entry, ...list].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(userKey(RECENT_KEY, userId), JSON.stringify(next));
  } catch {
    // not saved; the chat still works
  }
}

export async function deleteRecentCheck(userId: string, id: string): Promise<RecentCheck[]> {
  const next = (await getRecentChecks(userId)).filter((c) => c.id !== id);
  try {
    await AsyncStorage.setItem(userKey(RECENT_KEY, userId), JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export async function clearRecentChecks(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(userKey(RECENT_KEY, userId));
  } catch {
    // ignore
  }
}
