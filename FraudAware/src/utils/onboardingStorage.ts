import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_SEEN_KEY = '@fraudaware/onboarding_seen';

export async function getOnboardingSeen(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
    return value === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  } catch {
    // Ignore storage failures — user can see onboarding again.
  }
}
