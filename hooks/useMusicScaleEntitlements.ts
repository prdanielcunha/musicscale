import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  entitlementsService,
  MusicScaleFeatures,
  MusicScaleLimits,
  MusicScalePlan,
  MusicScaleUsage,
} from '../services/entitlementsService';

/**
 * Canonical client entitlement adapter.
 *
 * AuthContext owns the organization-scoped entitlement snapshot because it also
 * owns Hub handoff identity, the canonical ecosystem role, tenant switching and
 * the server-backed /limits response. Keeping a second fetch/cache here caused
 * Premium gates (notably AI chord creation) to disagree with the identity shown
 * elsewhere in the app when the Hub knew a user was CEO but the local profile
 * projection had not caught up yet.
 *
 * UI remains only a consumer. Server endpoints continue to authorize AI/actions
 * independently; this hook does not grant membership or RBAC.
 */
export function useMusicScaleEntitlements() {
  const {
    effectiveOrganizationId,
    entitlements,
    isEntitlementsLoaded,
    loading: authLoading,
    hydrationError,
    refreshSubscriptionAccess,
  } = useAuth();

  const scopedEntitlements =
    entitlements?.organizationId === effectiveOrganizationId
      ? entitlements
      : null;

  const refresh = useCallback(async () => {
    if (!effectiveOrganizationId) return;
    await refreshSubscriptionAccess();
  }, [effectiveOrganizationId, refreshSubscriptionAccess]);

  return {
    entitlements: scopedEntitlements,
    loading: authLoading || !isEntitlementsLoaded,
    error: hydrationError,
    refresh,
  };
}

export function useMusicScalePlan() {
  const { entitlements, loading } = useMusicScaleEntitlements();

  return {
    plan: entitlements?.plan || 'starter' as MusicScalePlan,
    status: entitlements?.status || 'none',
    loading,
  };
}

export function useMusicScaleUsage() {
  const { entitlements, loading: entitlementsLoading, refresh } = useMusicScaleEntitlements();
  const [realUsage, setRealUsage] = useState<MusicScaleUsage>({ libraryImports: 0 });
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    if (!entitlements?.organizationId) {
      setUsageLoading(false);
      return;
    }

    // Pro trial usage is a lifetime evaluation counter returned by the server,
    // not a calendar-month counter. Refreshes after imports keep this value fresh.
    if (entitlements.plan === 'pro' && entitlements.status === 'trialing') {
      setRealUsage({
        libraryImports: entitlements.usage?.libraryImports || 0,
        users: entitlements.usage?.users
      });
      setUsageLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    Promise.all([
      import('../services/usageService'),
      import('../services/firebase'),
      import('firebase/firestore')
    ]).then(([{ getCurrentMonthString }, { db }, { doc, onSnapshot }]) => {
      if (cancelled) return;
      const monthStr = getCurrentMonthString();
      const usageDocRef = doc(db, 'organizations', entitlements.organizationId, 'monthly_usage', monthStr);

      unsubscribe = onSnapshot(usageDocRef, (snap: any) => {
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
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [
    entitlements?.organizationId,
    entitlements?.plan,
    entitlements?.status,
    entitlements?.usage?.libraryImports,
    entitlements?.usage?.users
  ]);

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
    limits: (entitlements?.limits || {
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

  const isFeatureAllowed = useMemo(() => {
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
