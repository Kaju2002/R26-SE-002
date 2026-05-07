import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalysisPayload } from '../navigation/detectStackTypes';

const STORAGE_KEY = '@fraudaware:message_analysis_snapshots';

/** Persists one snapshot locally (same storage as Message Analyzer result screen). */
export async function saveAnalysisSnapshot(payload: AnalysisPayload): Promise<void> {
  const entry = {
    savedAt: new Date().toISOString(),
    ...payload,
  };
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  let list: typeof entry[];
  try {
    list = existing ? (JSON.parse(existing) as typeof entry[]) : [];
  } catch {
    list = [];
  }
  list.unshift(entry);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
}
