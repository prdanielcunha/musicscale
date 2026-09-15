import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FEATURE_RELEASE } from '../lib/appRelease';

const changed = 'musicscale:release-news-changed';
const memory = new Map<string, string>();
function read(key: string): string {
  try { return window.localStorage.getItem(key) ?? memory.get(key) ?? ''; }
  catch { return memory.get(key) ?? ''; }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(changed, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(changed, callback);
  };
}
export function useReleaseNews() {
  const { user } = useAuth();
  const key = user?.uid ? `musicscale_release_seen:${user.uid}` : '';
  const seen = useSyncExternalStore(subscribe, () => key ? read(key) : '', () => '');
  const markReleaseSeen = useCallback(() => {
    if (!key) return;
    memory.set(key, FEATURE_RELEASE.id);
    try { window.localStorage.setItem(key, FEATURE_RELEASE.id); } catch { /* session fallback */ }
    window.dispatchEvent(new Event(changed));
  }, [key]);
  return {
    hasUnseenRelease: !!key && seen !== FEATURE_RELEASE.id && Date.now() >= Date.parse(FEATURE_RELEASE.publishedAt),
    markReleaseSeen,
  };
}
