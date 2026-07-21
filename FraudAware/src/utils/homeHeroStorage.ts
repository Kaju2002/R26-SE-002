import AsyncStorage from '@react-native-async-storage/async-storage';

const HERO_DISMISSED_AT_KEY = '@fraudaware/home_hero_dismissed_at';
/** Banner can return after this many days. */
const DISMISS_DAYS = 7;
const LEGACY_DISMISSED_KEY = '@fraudaware/home_hero_dismissed';

export async function getHomeHeroDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(HERO_DISMISSED_AT_KEY);
    if (raw) {
      const dismissedAt = Number(raw);
      if (!Number.isFinite(dismissedAt)) return false;
      const ageMs = Date.now() - dismissedAt;
      const windowMs = DISMISS_DAYS * 24 * 60 * 60 * 1000;
      return ageMs < windowMs;
    }

    // Migrate legacy permanent dismiss → treat as dismissed now (starts 7-day clock)
    const legacy = await AsyncStorage.getItem(LEGACY_DISMISSED_KEY);
    if (legacy === '1') {
      await markHomeHeroDismissed();
      await AsyncStorage.removeItem(LEGACY_DISMISSED_KEY);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function markHomeHeroDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(HERO_DISMISSED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Call on logout so next login can see the hero again. */
export async function clearHomeHeroDismissed(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([HERO_DISMISSED_AT_KEY, LEGACY_DISMISSED_KEY]);
  } catch {
    // ignore
  }
}
