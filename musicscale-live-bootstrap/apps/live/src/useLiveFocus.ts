import { useCallback, useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  released?: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

type WakeLockNavigatorLike = {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

export function useLiveFocus(enabled: boolean) {
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [wakeActive, setWakeActive] = useState(false);
  const sentinel = useRef<WakeLockSentinelLike | null>(null);
  const wakeSupported = Boolean((navigator as unknown as WakeLockNavigatorLike).wakeLock?.request);

  const requestWakeLock = useCallback(async () => {
    if (!enabled || !wakeSupported || document.visibilityState !== 'visible') return false;
    try {
      if (sentinel.current && !sentinel.current.released) {
        setWakeActive(true);
        return true;
      }
      const next = await (navigator as unknown as WakeLockNavigatorLike).wakeLock!.request('screen');
      sentinel.current = next;
      setWakeActive(true);
      next.addEventListener?.('release', () => {
        if (sentinel.current === next) sentinel.current = null;
        setWakeActive(false);
      });
      return true;
    } catch {
      sentinel.current = null;
      setWakeActive(false);
      return false;
    }
  }, [enabled, wakeSupported]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!enabled) {
      const current = sentinel.current;
      sentinel.current = null;
      setWakeActive(false);
      void current?.release().catch(() => {});
      return;
    }

    void requestWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      const current = sentinel.current;
      sentinel.current = null;
      setWakeActive(false);
      void current?.release().catch(() => {});
    };
  }, [enabled, requestWakeLock]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen is a progressive enhancement. Live operation must continue.
    }
  }, []);

  return {
    fullscreen,
    wakeActive,
    wakeSupported,
    toggleFullscreen,
    requestWakeLock
  };
}
