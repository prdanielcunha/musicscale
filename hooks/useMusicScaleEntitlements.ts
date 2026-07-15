import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEcosystem } from '../contexts/EcosystemContext';
import { useEcosystemAdmin } from './useEcosystemAdmin';
import {
  entitlementsService,
  MusicScaleEntitlements,
  MusicScaleFeatures,
  MusicScaleLimits,
  MusicScalePlan,
  MusicScaleUsage,
  getStarterFallback,
} from '../services/entitlementsService';
import { logger } from '../lib/logger';

// Reactive local memory cache to prevent multiple simultaneous requests across components on same mount
let globalCachedEntitlements: Record<string, MusicScaleEntitlements> = {};
let globalFetchPromises: Record<string, Promise<MusicScaleEntitlements>> = {};

export function useMusicScaleEntitlements() {
  const { effectiveOrganizationId, loading: authLoading } = useAuth();
  const orgId = effectiveOrganizationId;

  // Attempt to load immediate sync state from memory or localStorage to avoid flickering
  const initialEntitlements = useMemo<MusicScaleEntitlements | null>(() => {
    if (!orgId) return null;
    if (globalCachedEntitlements[orgId]) {
      return globalCachedEntitlements[orgId];
    }
    // Attempt local Storage initial hydration
    try {
      const saved = localStorage.getItem(`musicscale.entitlements.cached.${orgId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.app === 'musicscale') {
          return parsed as MusicScaleEntitlements;
        }
      }
    } catch (e) {}
    
    // Default safe Starter mode until api finishes fetching
    return getStarterFallback(orgId);
  }, [orgId]);

  const [entitlements, setEntitlements] = useState<MusicScaleEntitlements | null>(initialEntitlements);
  const [loading, setLoading] = useState<boolean>(!initialEntitlements || initialEntitlements.status === 'inactive');
  const [error, setError] = useState<string | null>(null);

  const fetchFreshEntitlements = useCallback(async (targetOrgId: string, force = false) => {
    if (!targetOrgId) return;

    // Use shared dynamic promise to prevent duplicate concurrent network fetch operations
    if (globalFetchPromises[targetOrgId] && !force) {
      try {
        const data = await globalFetchPromises[targetOrgId];
        setEntitlements(data);
        setLoading(false);
        return;
      } catch (e) {}
    }

    const fetchPromise = entitlementsService.fetchEntitlements(targetOrgId, force);
    globalFetchPromises[targetOrgId] = fetchPromise;

    try {
      const data = await fetchPromise;
      globalCachedEntitlements[targetOrgId] = data;
      setEntitlements(data);
      setError(null);
      
      // Save cache to localStorage to enable instant loading on subsequent page reloads
      try {
        localStorage.setItem(`musicscale.entitlements.cached.${targetOrgId}`, JSON.stringify(data));
      } catch (e) {}
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Log failure in background
      logger.error(`[useMusicScaleEntitlements] Failed to update entitlements for org ${targetOrgId}`, err);
    } finally {
      delete globalFetchPromises[targetOrgId];
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId && !authLoading) {
      // Background revalidation
      fetchFreshEntitlements(orgId);
    }
  }, [orgId, authLoading, fetchFreshEntitlements]);

  // Expose a force-refresh function
  const refresh = useCallback(async () => {
    if (orgId) {
      setLoading(true);
      await fetchFreshEntitlements(orgId, true);
    }
  }, [orgId, fetchFreshEntitlements]);

  const { isEcosystemAdmin } = useEcosystemAdmin();
  
  const effectiveEntitlements = useMemo(() => {
    let finalEnt = entitlements || (orgId ? getStarterFallback(orgId) : null);
    if (!finalEnt) return null;
    
    // Global bypass for CEO/Admin
    if (isEcosystemAdmin) {
      return {
        ...finalEnt,
        plan: 'pro' as MusicScalePlan,
        status: 'active',
        limits: {
          users: -1,
          songs: -1,
          scales: -1,
          bandScales: -1,
          libraryImportsPerMonth: -1
        },
        features: {
           basicSongFields: true,
           richTextLyrics: true,
           attachments: true,
           scaleCloning: true,
           scaleHistory: true,
           aiImport: true,
           aiSetlistInsights: true,
           aiCreateScale: true,
           cloudSync: true,
           priorityNewFeatures: true,
           unlimitedBandScales: true,
           libraryAccess: true,
           libraryLimited: true,
           libraryComplete: true,
        }
      };
    }
    return finalEnt;
  }, [entitlements, orgId, isEcosystemAdmin]);

  return {
    entitlements: effectiveEntitlements,
    loading: loading || authLoading,
    error,
    refresh,
  };
}

export function useMusicScalePlan() {
  const { entitlements, loading } = useMusicScaleEntitlements();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  
  if (isEcosystemAdmin) {
    return {
      plan: 'pro' as MusicScalePlan,
      status: 'active',
      loading,
    };
  }

  return {
    plan: entitlements?.plan || 'starter' as MusicScalePlan,
    status: entitlements?.status || 'none',
    loading,
  };
}

export function useMusicScaleUsage() {
  const { entitlements, loading: entitlementsLoading, refresh } = useMusicScaleEntitlements();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  const [realUsage, setRealUsage] = useState<MusicScaleUsage>({ libraryImports: 0 });
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    if (!entitlements?.organizationId) {
      setUsageLoading(false);
      return;
    }

    Promise.all([
      import('../services/usageService'),
      import('../services/firebase'),
      import('firebase/firestore')
    ]).then(([{ getCurrentMonthString }, { db }, { doc, onSnapshot }]) => {
      const monthStr = getCurrentMonthString();
      const usageDocRef = doc(db, 'organizations', entitlements.organizationId, 'monthly_usage', monthStr);
      
      const unsubscribe = onSnapshot(usageDocRef, (snap: any) => {
        if (snap.exists()) {
          setRealUsage({ 
            libraryImports: snap.data()?.libraryImports || 0,
            users: entitlements?.usage?.users
          });
        } else {
          setRealUsage({ 
            libraryImports: 0,
            users: entitlements?.usage?.users
          });
        }
        setUsageLoading(false);
      }, (err: any) => {
        console.error("Failed to listen to org usage", err);
        setUsageLoading(false);
      });
      
      return () => unsubscribe();
    });
  }, [entitlements?.organizationId]);
  
  const incrementUsage = useCallback(async (): Promise<boolean> => {
    // This is now handled safely by importGlobalLibrarySongsWithUsageCheck
    // but we can leave this here so UI components that still use it for anything
    // don't break. However we should deprecate it.
    if (!entitlements?.organizationId) return false;
    const success = await entitlementsService.incrementLibraryImportsUsage(entitlements.organizationId);
    if (success) {
      await refresh();
    }
    return success;
  }, [entitlements, refresh]);

  return {
    usage: realUsage,
    limits: isEcosystemAdmin ? { users: -1, songs: -1, scales: -1, bandScales: -1, libraryImportsPerMonth: -1 } : (entitlements?.limits || { 
      users: 10,
      songs: -1,
      scales: -1,
      bandScales: 1,
      libraryImportsPerMonth: 0 
    }),
    loading: entitlementsLoading || usageLoading,
    incrementUsage,
  };
}

export function useMusicScaleFeature(featureKey: keyof MusicScaleFeatures): boolean {
  const { entitlements } = useMusicScaleEntitlements();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  
  if (isEcosystemAdmin) return true;

  // Guard Check in cases where subscription status is canceled/expired/past_due/inactive/none
  const isSuspended = useMemo(() => {
    if (!entitlements) return true;
    const s = entitlements.status;
    return s === 'past_due' || s === 'canceled' || s === 'expired' || s === 'inactive' || s === 'none';
  }, [entitlements]);

  if (isSuspended) {
    // If billing status is past_due or canceled, we gracefully block operations, EXCEPT basic access
    if (featureKey === 'cloudSync' || featureKey === 'basicSongFields') {
      return entitlements?.features?.cloudSync || false;
    }
    return false;
  }

  return entitlements?.features?.[featureKey] || false;
}

export function useMusicScaleLimit(limitKey: keyof MusicScaleLimits): number {
  const { entitlements } = useMusicScaleEntitlements();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  if (isEcosystemAdmin) return -1; // -1 represents Infinity
  return entitlements?.limits?.[limitKey] ?? -1;
}

/**
 * Advanced hook: Checks if organization plan supports a feature AND the current authenticated
 * user has the appropriate capability/permissions.
 */
export function useCanUseMusicScaleFeature(
  featureKey: keyof MusicScaleFeatures,
  permissionKey?: 'canManageOrganization' | 'canManageMembers' | 'canManageScales' | 'canManageRepertoire' | string
): { canUse: boolean; isFeatureAllowed: boolean; isPermissionAllowed: boolean; loading: boolean } {
  const { entitlements, loading } = useMusicScaleEntitlements();
  const { permissions } = useAuth();
  const { isEcosystemAdmin } = useEcosystemAdmin();

  const isFeatureAllowed = useMemo(() => {
    if (isEcosystemAdmin) return true;
    if (!entitlements) return false;
    
    // Status lock validation
    const s = entitlements.status;
    const isSuspended = s === 'past_due' || s === 'canceled' || s === 'expired' || s === 'inactive' || s === 'none';
    if (isSuspended) {
      return featureKey === 'cloudSync' || featureKey === 'basicSongFields';
    }

    return !!entitlements.features?.[featureKey];
  }, [entitlements, featureKey]);

  const isPermissionAllowed = useMemo(() => {
    if (isEcosystemAdmin) return true;
    if (!permissions) return false;
    
    // If no permissionKey specified, assume true
    if (!permissionKey) return true;

    // Check custom permissions/capabilities
    return !!permissions[permissionKey as string];
  }, [permissions, permissionKey]);

  return {
    canUse: isFeatureAllowed && isPermissionAllowed,
    isFeatureAllowed,
    isPermissionAllowed,
    loading,
  };
}

/**
 * Hook to enforce feature gate, trigger logging, and return lock status.
 */
export function useRequireMusicScaleFeature(featureKey: keyof MusicScaleFeatures) {
  const { entitlements } = useMusicScaleEntitlements();
  const isAllowed = useMusicScaleFeature(featureKey);

  const triggerAccessDeniedLog = useCallback(() => {
    if (!entitlements) return;
    entitlementsService.logAnalytics('feature_blocked', {
      organizationId: entitlements.organizationId,
      feature: featureKey,
      plan: entitlements.plan,
    });
  }, [entitlements, featureKey]);

  return {
    isAllowed,
    triggerAccessDeniedLog,
  };
}
