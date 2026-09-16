import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import React from 'react';

export type NewsCategory = 'feature' | 'improvement' | 'new_app' | 'promotion' | 'paid_addon' | 'announcement' | 'important';
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

// Generic announcements remain available for future non-release notices. They
// never decide whether the feature-release presentation opens automatically.
export const DYNAMIC_NEWS: NewsAnnouncement[] = [];

const readStoredSeenNewsIds = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const storedNews = window.localStorage.getItem('musicscale_seen_news');
    if (!storedNews) return [];

    const parsed = JSON.parse(storedNews);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch (error) {
    console.error('Failed to parse news storage', error);
    return [];
  }
};

export function useNews() {
  const { isOwner, isAdmin, isGlobalAdmin, isCurationAdmin, userProfile } = useAuth();
  const [seenNewsIds, setSeenNewsIds] = useState<string[]>(readStoredSeenNewsIds);

  const markAsSeen = useCallback((id: string | string[]) => {
    const ids = Array.isArray(id) ? id : [id];
    if (ids.length === 0) return;

    setSeenNewsIds((current) => {
      const newSeen = Array.from(new Set([...current, ...ids]));
      try {
        window.localStorage.setItem('musicscale_seen_news', JSON.stringify(newSeen));
      } catch (error) {
        console.error('Failed to save seen news', error);
      }
      return newSeen;
    });
  }, []);

  const activeNews = useMemo(() => {
    const now = new Date().toISOString();
    return DYNAMIC_NEWS.filter((news) => {
      if (!news.active) return false;
      if (news.publishedAt > now) return false;
      if (news.expiresAt && news.expiresAt < now) return false;

      const audiences = Array.isArray(news.audience) ? news.audience : [news.audience];
      if (audiences.includes('all_users')) return true;
      if (audiences.includes('organization_admins') && (isOwner || isAdmin || isGlobalAdmin)) return true;
      if (audiences.includes('ecosystem_roles') && (isGlobalAdmin || isCurationAdmin)) return true;

      const role = String(userProfile?.systemRole || userProfile?.role || '').toLowerCase();
      return audiences.includes(role);
    }).sort(
      (a, b) =>
        b.priority - a.priority ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }, [isAdmin, isOwner, isGlobalAdmin, isCurationAdmin, userProfile]);

  const unseenNews = useMemo(
    () => activeNews.filter((news) => !seenNewsIds.includes(news.id)),
    [activeNews, seenNewsIds],
  );

  return {
    allActiveNews: activeNews,
    unseenNews,
    markAsSeen,
    hasUnseen: unseenNews.length > 0,
    isLoaded: true,
  };
}
