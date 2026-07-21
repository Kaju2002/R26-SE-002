import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getUnreadNotificationCount,
  markAllNotificationsRead,
} from '../api/notificationApi';
import { useUser } from './UserContext';

type NotificationsUnreadContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  /** Marks all as read and clears the home bell badge. */
  markAllReadAndClearBadge: () => Promise<void>;
};

const NotificationsUnreadContext =
  createContext<NotificationsUnreadContextValue | null>(null);

export function NotificationsUnreadProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { token, isAuthenticated } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getUnreadNotificationCount(token);
      setUnreadCount(
        Math.max(0, Number(response.unreadCount) || 0)
      );
    } catch {
      // Keep last known count on transient failures
    }
  }, [token, isAuthenticated]);

  const markAllReadAndClearBadge = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      await markAllNotificationsRead(token);
      setUnreadCount(0);
    } catch {
      await refreshUnreadCount();
    }
  }, [token, refreshUnreadCount]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      void refreshUnreadCount();
    }, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, refreshUnreadCount]);

  return (
    <NotificationsUnreadContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount,
        markAllReadAndClearBadge,
      }}
    >
      {children}
    </NotificationsUnreadContext.Provider>
  );
}

export function useNotificationsUnread() {
  const ctx = useContext(NotificationsUnreadContext);
  if (!ctx) {
    return {
      unreadCount: 0,
      refreshUnreadCount: async () => undefined,
      markAllReadAndClearBadge: async () => undefined,
    };
  }
  return ctx;
}
