import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import type { RootStackParamList } from '../navigation/rootStackParams';
import {
  conversationIdFromNotificationData,
  syncPushRegistration,
} from './pushRegistration';

type Props = {
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
};

function openConversation(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  conversationId: string
) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(
    'MainTabs',
    {
      screen: 'Chat',
      params: {
        screen: 'InchatThread',
        params: { threadId: conversationId },
      },
    } as never
  );
}

/**
 * Registers the Expo push token after login and opens InChat when a push is tapped.
 */
export default function PushNotificationBootstrap({ navigationRef }: Props) {
  const { token, isAuthenticated } = useUser();
  const responseSub = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    void syncPushRegistration(token).catch((error) => {
      console.warn('Push registration failed:', error);
    });
  }, [isAuthenticated, token]);

  useEffect(() => {
    responseSub.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const conversationId = conversationIdFromNotificationData(
          response.notification.request.content.data as Record<string, unknown>
        );
        if (conversationId) {
          openConversation(navigationRef, conversationId);
        }
      }
    );

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const conversationId = conversationIdFromNotificationData(
        response.notification.request.content.data as Record<string, unknown>
      );
      if (conversationId) {
        openConversation(navigationRef, conversationId);
      }
    });

    return () => {
      responseSub.current?.remove();
      responseSub.current = null;
    };
  }, [navigationRef]);

  return null;
}
