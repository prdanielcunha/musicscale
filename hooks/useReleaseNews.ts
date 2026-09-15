import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FEATURE_RELEASE } from '../lib/appRelease';

const changed = 'musicscale:release-news-changed';
const memory = new Map<string, string>();
function read(key: string): string {
  try { return memory.get(key) ?? window.localStorage.getItem(key) ?? ''; }
  catch { return memory.get(key) ?? ''; }
}
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key) memory.delete(event.key);
    callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(changed, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(changed, callback);
  };
}
export function useReleaseNews() {
  const { user } = useAuth();
  const key = user?.uid ? `musicscale_release_seen:${user.uid}` : '';
  const seen = useSyncExternalStore(subscribe, () => key ? read(key) : '', () => '');
  const markReleaseSeen = useCallback(() => {
    if (!key) return;
    try {
      window.localStorage.setItem(key, FEATURE_RELEASE.id);
      memory.delete(key);
    } catch {
      memory.set(key, FEATURE_RELEASE.id);
    }
    window.dispatchEvent(new Event(changed));
  }, [key]);
  return {
    hasUnseenRelease: !!key && seen !== FEATURE_RELEASE.id && Date.now() >= Date.parse(FEATURE_RELEASE.publishedAt),
    markReleaseSeen,
  };
}
