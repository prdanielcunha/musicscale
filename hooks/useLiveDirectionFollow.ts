import { useCallback, useEffect, useState } from "react";

const EVENT_NAME = "musicscale:live-follow-changed";

function storageKey(scaleId?: string) {
  return scaleId ? `musicscale:live-follow:${scaleId}` : null;
}

export function useLiveDirectionFollow(scaleId?: string) {
  const [isFollowingDirection, setIsFollowingDirectionState] = useState(true);

  useEffect(() => {
    const key = storageKey(scaleId);
    if (!key) {
      setIsFollowingDirectionState(true);
      return;
    }

    const stored = sessionStorage.getItem(key);
    setIsFollowingDirectionState(stored !== "free");

    const handleChange = (event: Event) => {
      const custom = event as CustomEvent<{
        scaleId?: string;
        isFollowingDirection?: boolean;
      }>;
      if (custom.detail?.scaleId !== scaleId) return;
      if (typeof custom.detail?.isFollowingDirection !== "boolean") return;
      setIsFollowingDirectionState(custom.detail.isFollowingDirection);
    };

    window.addEventListener(EVENT_NAME, handleChange);
    return () => window.removeEventListener(EVENT_NAME, handleChange);
  }, [scaleId]);

  const setIsFollowingDirection = useCallback(
    (next: boolean) => {
      const key = storageKey(scaleId);
      setIsFollowingDirectionState(next);
      if (key) sessionStorage.setItem(key, next ? "follow" : "free");
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: { scaleId, isFollowingDirection: next },
        }),
      );
    },
    [scaleId],
  );

  const toggleFollowingDirection = useCallback(() => {
    setIsFollowingDirectionState((current) => {
      const next = !current;
      const key = storageKey(scaleId);
      if (key) sessionStorage.setItem(key, next ? "follow" : "free");
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: { scaleId, isFollowingDirection: next },
        }),
      );
      return next;
    });
  }, [scaleId]);

  return {
    isFollowingDirection,
    setIsFollowingDirection,
    toggleFollowingDirection,
  };
}
