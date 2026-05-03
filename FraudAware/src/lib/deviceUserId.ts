import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const STORAGE_KEY = '@fraudaware:device_user_id';

/** Stable anonymous id per install; replace with auth user id when you add accounts. */
export async function getOrCreateDeviceUserId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing.trim();
  }
  const id = randomUUID();
  await AsyncStorage.setItem(STORAGE_KEY, id);
  return id;
}
