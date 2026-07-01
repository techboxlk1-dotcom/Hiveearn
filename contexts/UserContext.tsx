'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Notification } from '@/lib/supabase';
import { getUserByTelegramId, upsertUser, getUserNotifications, markAllNotificationsRead } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// Telegram ID that always has admin access
const ADMIN_TELEGRAM_ID = 5419054691;

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
  isManager: boolean;
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

        // Fallback for browser preview (uses admin ID so admin panel is accessible)
        if (!tgUser) {
          tgUser = {
            id: ADMIN_TELEGRAM_ID,
            username: 'Pandatechnic',
            first_name: 'PANDA',
            last_name: undefined,
            photo_url: undefined,
          };
        }

        setTelegramUser(tgUser);

        // Check for referral param
        const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const startParam = urlParams.get('tgWebAppStartParam') || '';
        const referralCode = startParam.startsWith('ref_') ? startParam.replace('ref_', '') : undefined;

        // Fetch client IP via public service (best-effort, non-blocking)
        let ipAddress: string | undefined;
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          if (ipRes.ok) {
            const ipData = await ipRes.json() as { ip?: string };
            ipAddress = ipData.ip;
          }
        } catch { /* ignore */ }

        const dbUser = await upsertUser({
          telegram_id: tgUser.id,
          username: tgUser.username,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          photo_url: tgUser.photo_url,
          referral_code_used: referralCode,
          ip_address: ipAddress,
        });

        // Ensure admin flag is set for the hardcoded admin Telegram ID
        if (dbUser && tgUser.id === ADMIN_TELEGRAM_ID && !dbUser.is_admin) {
          await supabase.from('users').update({ is_admin: true }).eq('id', dbUser.id);
          dbUser.is_admin = true;
        }

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

  // Admin if DB flag OR matches hardcoded admin Telegram ID
  const isAdmin = (user?.is_admin ?? false) || (telegramUser?.id === ADMIN_TELEGRAM_ID);
  const isManager = user?.is_manager ?? false;

  return (
    <UserContext.Provider value={{ user, telegramUser, notifications, unreadCount, isLoading, isAdmin, isManager, refreshUser, refreshNotifications, markAllRead }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
