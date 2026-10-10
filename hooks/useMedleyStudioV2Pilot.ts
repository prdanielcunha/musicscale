import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlag } from './useFeatureFlag';

/**
 * Explicit client-only pilot preference; never a security entitlement.
 * The real create/update permission is still enforced by the server.
 * Without an organization rollout flag or user opt-in, V2 remains OFF.
 */
export function useMedleyStudioV2Pilot() {
  const orgEnabled = useFeatureFlag('musicscale.medleyStudioV2');
  const { user, effectiveOrganizationId } = useAuth();
  const key = useMemo(() => user?.uid && effectiveOrganizationId
    ? ['musicscale', 'medleyStudioV2', 'pilot', user.uid, effectiveOrganizationId].map(encodeURIComponent).join(':')
    : null, [user?.uid, effectiveOrganizationId]);
  const [optedIn, setOptedIn] = useState(false);
  useEffect(() => {
    if (!key) { setOptedIn(false); return; }
    try { setOptedIn(localStorage.getItem(key) === 'enabled'); }
    catch { setOptedIn(false); }
    const refresh = () => {
      try { setOptedIn(localStorage.getItem(key) === 'enabled'); }
      catch { setOptedIn(false); }
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('musicscale-medley-pilot-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('musicscale-medley-pilot-changed', refresh);
    };
  }, [key]);
  const setPilotEnabled = useCallback((next: boolean) => {
    if (!key) return;
    try {
      if (next) localStorage.setItem(key, 'enabled');
      else localStorage.removeItem(key);
      setOptedIn(next);
      window.dispatchEvent(new Event('musicscale-medley-pilot-changed'));
    } catch { setOptedIn(false); }
  }, [key]);
  return { enabled: orgEnabled || optedIn, orgEnabled, optedIn, setPilotEnabled };
}
