'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Notification } from '@/lib/supabase';
import { getUserByTelegramId, upsertUser, getUserNotifications, markAllNotificationsRead } from '@/lib/api';

interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
}

interface UserContextType {
  user: User | null;
  telegramUser: TelegramUser | null;
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!telegramUser) return;
    const u = await getUserByTelegramId(telegramUser.id);
    setUser(u);
  }, [telegramUser]);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const notifs = await getUserNotifications(user.id);
    setNotifications(notifs);
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, [user]);

  useEffect(() => {
    const initUser = async () => {
      setIsLoading(true);
      try {
        // Try to get Telegram WebApp data
        let tgUser: TelegramUser | null = null;

        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          tg.ready();
          tg.expand();

          const initData = tg.initDataUnsafe?.user;
          if (initData) {
            tgUser = {
              id: initData.id,
              username: initData.username,
              first_name: initData.first_name ?? 'User',
              last_name: initData.last_name,
              photo_url: initData.photo_url,
            };
          }
        }

        // Fallback for development/demo
        if (!tgUser) {
          tgUser = {
            id: 5419054691,
            username: 'hiveearndemo',
            first_name: 'Hive',
            last_name: 'User',
            photo_url: undefined,
          };
        }

        setTelegramUser(tgUser);

        // Check URL for referral code
        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const startParam = urlParams.get('tgWebAppStartParam') || '';
        const referralCode = startParam.startsWith('ref_') ? startParam.replace('ref_', '') : undefined;

        const dbUser = await upsertUser({
          telegram_id: tgUser.id,
          username: tgUser.username,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          photo_url: tgUser.photo_url,
          referral_code_used: referralCode,
        });

        setUser(dbUser);
      } catch (err) {
        console.error('Failed to init user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initUser();
  }, []);

  useEffect(() => {
    if (user) refreshNotifications();
  }, [user, refreshNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const isAdmin = user?.is_admin ?? false;

  return (
    <UserContext.Provider value={{ user, telegramUser, notifications, unreadCount, isLoading, isAdmin, refreshUser, refreshNotifications, markAllRead }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
