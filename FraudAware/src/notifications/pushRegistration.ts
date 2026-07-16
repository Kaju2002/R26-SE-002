import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken, unregisterPushToken } from '../api/pushApi';

const STORED_PUSH_TOKEN_KEY = '@fraudaware/expo_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolveProjectId(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('chat-messages', {
    name: 'Chat messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#202871',
  });

  await Notifications.setNotificationChannelAsync('scam-alerts', {
    name: 'Scam alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#B42318',
  });
}

/**
 * Ask permission, fetch Expo push token, and register it with notification-management.
 * Safe no-op on web / simulators / missing project id.
 */
export async function syncPushRegistration(authToken: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

  await ensureAndroidChannels();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    console.warn('Push notification permission not granted.');
    return null;
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn(
      'Missing Expo projectId. Set EXPO_PUBLIC_EAS_PROJECT_ID or run `eas init`.'
    );
    return null;
  }

  const push = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = push.data;
  if (!token) return null;

  await registerPushToken(authToken, {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
    deviceName: Device.modelName ?? Device.deviceName ?? '',
  });
  await AsyncStorage.setItem(STORED_PUSH_TOKEN_KEY, token);
  return token;
}

export async function clearPushRegistration(authToken: string | null): Promise<void> {
  const stored = await AsyncStorage.getItem(STORED_PUSH_TOKEN_KEY);
  if (stored && authToken) {
    try {
      await unregisterPushToken(authToken, stored);
    } catch (error) {
      console.warn('Could not unregister push token:', error);
    }
  }
  await AsyncStorage.removeItem(STORED_PUSH_TOKEN_KEY);
}

export function conversationIdFromNotificationData(
  data: Record<string, unknown> | undefined
): string | undefined {
  if (!data) return undefined;
  const value = data.conversationId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
