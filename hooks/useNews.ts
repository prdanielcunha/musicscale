import { useState, useEffect, useMemo, useCallback } from 'react';
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

export function useNews() {
  const { isOwner, isAdmin, isGlobalAdmin, isCurationAdmin, userProfile } = useAuth();
  
  const [seenNewsIds, setSeenNewsIds] = useState<string[]>([]);
  const [isWelcomeDismissed, setIsWelcomeDismissed] = useState<boolean>(true); // default true until loaded to prevent flash
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedNews = localStorage.getItem('musicscale_seen_news');
      if (storedNews) {
        setSeenNewsIds(JSON.parse(storedNews));
      }
      
      const storedWelcome = localStorage.getItem('musicscale_welcome_dismissed');
      const legacyWelcome = localStorage.getItem('hasSeenOnboarding_v1');
      setIsWelcomeDismissed(storedWelcome === 'true' || legacyWelcome === 'true');
      setIsLoaded(true);
    } catch (e) {
      console.error('Failed to parse news storage', e);
      setIsLoaded(true);
      setIsWelcomeDismissed(false);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    setIsWelcomeDismissed(true);
    try {
      localStorage.setItem('musicscale_welcome_dismissed', 'true');
    } catch (e) {
      console.error('Failed to save welcome dismissal', e);
    }
  }, []);

  const markAsSeen = (id: string | string[]) => {
    try {
      const ids = Array.isArray(id) ? id : [id];
      if (ids.length === 0) return;
      const newSeen = Array.from(new Set([...seenNewsIds, ...ids]));
      setSeenNewsIds(newSeen);
      localStorage.setItem('musicscale_seen_news', JSON.stringify(newSeen));
    } catch (e) {
      console.error('Failed to save seen news', e);
    }
  };

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
    hasUnseen: unseenNews.length > 0 || (!isWelcomeDismissed && isLoaded),
    isWelcomeDismissed,
    dismissWelcome,
    isLoaded
  };
}
