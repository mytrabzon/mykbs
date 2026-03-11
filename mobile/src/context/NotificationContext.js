import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import * as communityApi from '../services/communityApi';

const NotificationContext = createContext({ unreadCount: 0, refresh: () => {} });

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { getSupabaseToken } = useAuth();

  const refresh = useCallback(async () => {
    const token = await getSupabaseToken();
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await communityApi.getInAppNotifications({ limit: 1 }, token);
      setUnreadCount(res?.unread_count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [getSupabaseToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub?.remove?.();
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationUnread() {
  const ctx = useContext(NotificationContext);
  return ctx ?? { unreadCount: 0, refresh: () => {} };
}
