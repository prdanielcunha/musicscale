import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Zap, Shield, Star, Rocket, Tag, Info, AppWindow, Megaphone, ShoppingBag } from 'lucide-react';
import React from 'react';

export type NewsCategory = 'welcome' | 'feature' | 'improvement' | 'new_app' | 'promotion' | 'paid_addon' | 'announcement' | 'important';
export type NewsAudience = 'all_users' | 'organization_admins' | 'ecosystem_roles' | string;

export interface NewsAnnouncement {
  id: string;
  title: string;
  description: string;
  category: NewsCategory;
  image?: string;
  icon?: React.ReactNode;
  ctaLabel?: string;
  ctaRoute?: string;
  audience: NewsAudience | NewsAudience[];
  priority: number;
  publishedAt: string;
  expiresAt?: string;
  dismissible: boolean;
  active: boolean;
}

// Fallback / Initial Welcome News (if we wanted to treat them as announcements, but the welcome presentation is special, we'll keep DYNAMIC_NEWS for future ones)
export const DYNAMIC_NEWS: NewsAnnouncement[] = [
  // Example of a future announcement
  // {
  //   id: 'feat-ai-import-v1',
  //   title: 'Agora você pode importar cifras usando IA',
  //   description: 'Extraia letras e cifras de imagens ou PDFs automaticamente.',
  //   category: 'feature',
  //   icon: React.createElement(Sparkles, { className: "w-5 h-5" }),
  //   audience: 'all_users',
  //   priority: 90,
  //   publishedAt: '2023-11-01T00:00:00Z',
  //   dismissible: true,
  //   active: true,
  //   ctaLabel: 'Conhecer recurso',
  //   ctaRoute: '/ai-import'
  // }
];

const readStoredSeenNewsIds = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const storedNews = window.localStorage.getItem('musicscale_seen_news');
    if (!storedNews) return [];

    const parsed = JSON.parse(storedNews);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch (e) {
    console.error('Failed to parse news storage', e);
    return [];
  }
};

const readStoredWelcomeDismissed = (): boolean => {
  if (typeof window === 'undefined') return true;

  try {
    const storedWelcome = window.localStorage.getItem('musicscale_welcome_dismissed');
    const legacyWelcome = window.localStorage.getItem('hasSeenOnboarding_v1');
    return storedWelcome === 'true' || legacyWelcome === 'true';
  } catch (e) {
    console.error('Failed to read welcome storage', e);
    return false;
  }
};

export function useNews() {
  const { isOwner, isAdmin, isGlobalAdmin, isCurationAdmin, userProfile } = useAuth();

  // These preferences are local and synchronous. Resolve them in the lazy state
  // initializers so first-access UI does not wait for an effect after first paint.
  const [seenNewsIds, setSeenNewsIds] = useState<string[]>(readStoredSeenNewsIds);
  const [isWelcomeDismissed, setIsWelcomeDismissed] = useState<boolean>(readStoredWelcomeDismissed);

  const dismissWelcome = useCallback(() => {
    setIsWelcomeDismissed(true);
    try {
      window.localStorage.setItem('musicscale_welcome_dismissed', 'true');
    } catch (e) {
      console.error('Failed to save welcome dismissal', e);
    }
  }, []);

  const markAsSeen = useCallback((id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    if (ids.length === 0) return;

    setSeenNewsIds((current) => {
      const newSeen = Array.from(new Set([...current, ...ids]));
      try {
        window.localStorage.setItem('musicscale_seen_news', JSON.stringify(newSeen));
      } catch (e) {
        console.error('Failed to save seen news', e);
      }
      return newSeen;
    });
  }, []);

  const activeNews = useMemo(() => {
    const now = new Date().toISOString();
    return DYNAMIC_NEWS.filter(news => {
      if (!news.active) return false;
      if (news.expiresAt && news.expiresAt < now) return false;

      const audiences = Array.isArray(news.audience) ? news.audience : [news.audience];

      if (audiences.includes('all_users')) return true;

      if (audiences.includes('organization_admins') && (isOwner || isAdmin || isGlobalAdmin)) {
        return true;
      }

      if (audiences.includes('ecosystem_roles') && (isGlobalAdmin || isCurationAdmin)) {
        return true;
      }

      const role = String(userProfile?.systemRole || userProfile?.role || '').toLowerCase();
      if (audiences.includes(role)) {
        return true;
      }

      return false;
    }).sort((a, b) => b.priority - a.priority || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [isAdmin, isOwner, isGlobalAdmin, isCurationAdmin, userProfile]);

  const unseenNews = useMemo(() => {
    return activeNews.filter(n => !seenNewsIds.includes(n.id));
  }, [activeNews, seenNewsIds]);

  return {
    allActiveNews: activeNews,
    unseenNews,
    markAsSeen,
    hasUnseen: unseenNews.length > 0 || !isWelcomeDismissed,
    isWelcomeDismissed,
    dismissWelcome,
    isLoaded: true
  };
}
