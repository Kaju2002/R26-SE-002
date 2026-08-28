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

function openSupportTicket(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  ticketId: string
) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('SupportTicketDetail', { ticketId });
}

function routeFromNotificationData(
  data: Record<string, unknown> | undefined
) {
  if (!data) return null;

  const type = typeof data.type === 'string' ? data.type : '';
  if (type === 'support_reply' || type === 'support_ticket_created') {
    const ticketId = typeof data.ticketId === 'string' ? data.ticketId : '';
    if (ticketId) {
      return { kind: 'support' as const, ticketId };
    }
  }

  const conversationId = conversationIdFromNotificationData(data);
  if (conversationId) {
    return { kind: 'chat' as const, conversationId };
  }

  return null;
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
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const route = routeFromNotificationData(
        response.notification.request.content.data as Record<string, unknown>
      );
      if (!route) return;

      if (route.kind === 'support') {
        openSupportTicket(navigationRef, route.ticketId);
        return;
      }

      openConversation(navigationRef, route.conversationId);
    };

    responseSub.current = Notifications.addNotificationResponseReceivedListener(
      handleResponse
    );

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      handleResponse(response);
    });

    return () => {
      responseSub.current?.remove();
      responseSub.current = null;
    };
  }, [navigationRef]);

  return null;
}
