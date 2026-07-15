import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ecosystemBridge } from './ecosystem/EcosystemBridge';
import { logger } from '../lib/logger';
import { 
  MusicScalePlan, 
  MusicScaleFeatures, 
  MusicScaleLimits, 
  MusicScaleUsage, 
  MusicScaleEntitlements,
  PLAN_FEATURES,
  PLAN_LIMITS,
  DEFAULT_USAGE
} from './entitlementsConstants';

export type { MusicScalePlan, MusicScaleFeatures, MusicScaleLimits, MusicScaleUsage, MusicScaleEntitlements };
export { PLAN_FEATURES, PLAN_LIMITS, DEFAULT_USAGE };

// Safe Standard Fallback
export function getStarterFallback(orgId: string, statusOverride?: string): MusicScaleEntitlements {
  return {
    organizationId: orgId,
    app: 'musicscale',
    plan: 'starter',
    status: (statusOverride || 'inactive') as any,
    features: PLAN_FEATURES.starter,
    limits: PLAN_LIMITS.starter,
    usage: DEFAULT_USAGE,
    supportTier: 'standard',
    currentPeriodEnd: null,
    trialEndsAt: null,
    planUpdatedAt: new Date().toISOString(),
    entitlementsVersion: 2,
  };
}

class EntitlementsService {
  private static instance: EntitlementsService;
  private memoryCache: Record<string, { entitlements: MusicScaleEntitlements; fetchedAt: number }> = {};
  private activeRequests: Map<string, Promise<MusicScaleEntitlements>> = new Map();
  private cacheExpiryMs = 60000; // 1 minute reactive expiry

  public static getInstance(): EntitlementsService {
    if (!EntitlementsService.instance) {
      EntitlementsService.instance = new EntitlementsService();
    }
    return EntitlementsService.instance;
  }

  /**
   * Helper to determine base MillionsNest origin
   */
  public getMillionsNestBaseUrl(): string {
    const bridge = ecosystemBridge;
    try {
      const origin = bridge.getHostOrigin();
      if (origin && origin !== 'null') {
        return origin;
      }
    } catch (e) {}
    // Default fallback to MillionsNest domain or env
    return 'https://millionsnest.com';
  }

  /**
   * Normalize any API responses to our standard design spec
   */
  public normalizeEntitlements(raw: any, orgId: string): MusicScaleEntitlements {
    // Determine plan
    let rawPlan = (raw?.plan || 'starter').toLowerCase();
    if (rawPlan === 'trialing' || rawPlan === 'free') {
      rawPlan = 'starter';
    }
    const plan: MusicScalePlan = ['starter', 'advanced', 'pro'].includes(rawPlan)
      ? (rawPlan as MusicScalePlan)
      : 'starter';

    // Status mapping - Only allow active, trialing, or canceled (for grace period)
    let status = String(raw?.status || 'inactive').toLowerCase().trim();
    if (!['active', 'trialing', 'canceled'].includes(status)) {
      status = 'inactive';
    }
    const finalStatus = status as "active" | "past_due" | "canceled" | "trialing" | "inactive" | "expired" | "none";

    // Merge features with backend overrides
    const baseFeatures = PLAN_FEATURES[plan];
    const features = {
      ...baseFeatures,
      ...(raw?.features || {}),
    };

    // Merge limits with overrides
    const baseLimits = PLAN_LIMITS[plan];
    const limits = {
      ...baseLimits,
      ...(raw?.limits || {}),
    };

    // Merge usage
    const usage = {
      ...DEFAULT_USAGE,
      ...(raw?.usage || {}),
    };

    const supportTier = raw?.supportTier || (plan === 'pro' ? 'priority' : plan === 'advanced' ? 'basic_priority' : 'standard');

    return {
      organizationId: orgId,
      app: 'musicscale',
      plan,
      status: finalStatus,
      features,
      limits,
      usage,
      supportTier,
      currentPeriodEnd: raw?.currentPeriodEnd || null,
      trialEndsAt: raw?.trialEndsAt || null,
      planUpdatedAt: raw?.planUpdatedAt || null,
      entitlementsVersion: raw?.entitlementsVersion || 2,
    };
  }

  /**
   * Main function to fetch entitlements from MillionsNest
   */
  public invalidateOrganizationCache(orgId: string) {
    if (this.memoryCache[orgId]) {
      delete this.memoryCache[orgId];
    }
    localStorage.removeItem(`musicscale.entitlements.updatedAt.${orgId}`);
    localStorage.removeItem(`musicscale.entitlements.version.${orgId}`);
  }

  public async fetchEntitlements(orgId: string, forceRefresh = false): Promise<MusicScaleEntitlements> {
    if (!orgId) {
      return getStarterFallback('unauthenticated');
    }

    const cached = this.memoryCache[orgId];
    if (cached && !forceRefresh && Date.now() - cached.fetchedAt < this.cacheExpiryMs) {
      // Local session Cache check
      const localPlanUpdate = localStorage.getItem(`musicscale.entitlements.updatedAt.${orgId}`);
      const localVersion = localStorage.getItem(`musicscale.entitlements.version.${orgId}`);

      if (localPlanUpdate === cached.entitlements.planUpdatedAt && 
          Number(localVersion || 2) === cached.entitlements.entitlementsVersion) {
        return cached.entitlements;
      }
    }

    const requestKey = `${orgId}_${forceRefresh}`;
    if (this.activeRequests.has(requestKey)) {
      return this.activeRequests.get(requestKey)!;
    }

    const promise = (async () => {
    let token = '';
    try {
      // Fetch Firebase ID Token
      token = (await auth.currentUser?.getIdToken(forceRefresh)) || '';
    } catch (e) {
      logger.warn('[EntitlementsService] Failed to fetch Firebase auth token, trying ecosystem token fallback', e);
    }

    if (!token) {
      try {
        const ecoContext = ecosystemBridge.getContext();
        if (ecoContext?.token) {
          token = ecoContext.token;
        }
      } catch (e) {}
    }

    // Use local proxy to completely avoid any preflight / CORS issues with MillionsNest domains
    const endpoint = `/api/v1/organizations/${orgId}/limits`;

    logger.debug(`[EntitlementsService] Fetching entitlements from: ${endpoint}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
          },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        const data = await response.json();
        const normalized = this.normalizeEntitlements(data, orgId);
        // Update cache
        this.memoryCache[orgId] = { entitlements: normalized, fetchedAt: Date.now() };
        
        // Push cache validations to localStorage to track invalidations across refreshes
        if (normalized.planUpdatedAt) {
          localStorage.setItem(`musicscale.entitlements.updatedAt.${orgId}`, normalized.planUpdatedAt);
        }
        localStorage.setItem(`musicscale.entitlements.version.${orgId}`, String(normalized.entitlementsVersion));

        // Trigger analytics event
        this.logAnalytics('entitlements_loaded', {
          organizationId: orgId,
          plan: normalized.plan,
          status: normalized.status,
          currentUsage: normalized.usage.libraryImports,
          limit: normalized.limits.libraryImportsPerMonth,
        });

        return normalized;
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
            return getStarterFallback(orgId, 'unauthorized');
        }
        if (response.status === 403) {
            return getStarterFallback(orgId, 'forbidden');
        }
        if (response.status === 404) {
            return getStarterFallback(orgId, 'repair_required');
        }
        if (response.status === 409) {
            return getStarterFallback(orgId, 'forbidden'); // Divergência de organização
        }
        if (response.status >= 500) {
            return getStarterFallback(orgId, 'unavailable');
        }
        
        throw new Error(`MillionsNest API error: ${response.status}`);
      }
    } catch (apiError) {
      logger.debug('[EntitlementsService] MillionsNest API failed, resolving fallbacks:', apiError);
      
      this.logAnalytics('entitlements_refresh_failed', {
        organizationId: orgId,
        error: apiError instanceof Error ? apiError.message : String(apiError),
      });

      // --- FALLBACK CHAIN ---
      // Fallback 1: Try read from EcosystemContext via local event listener or previous bridge sync if loaded
      try {
        const ecoContext = ecosystemBridge.getContext();
        if (ecoContext && ecoContext.currentOrganizationId === orgId) {
          // If ecoContext contains capabilities, try to build a derived entitlements
          logger.info('[EntitlementsService] Fallback to Ecosystem Context payload.');
          // In MillionsNest, role capabilities exist, let's look at organization app caches if present
        }
      } catch (ecoError) {}

      // Fallback 2: Try to read from firestore cached document under /organizations/{orgId}.apps.musicscale
      if (orgId && orgId !== 'all') {
        try {
          const orgRef = doc(db, 'organizations', orgId);
          const orgSnap = await getDoc(orgRef);
          if (orgSnap.exists()) {
            const orgData = orgSnap.data();
            const cachedAppsData = orgData?.apps?.musicscale;
            if (cachedAppsData && (cachedAppsData.status === 'active' || cachedAppsData.status === 'trialing')) {
              logger.info('[EntitlementsService] Fallback successful! Read from apps.musicscale in organization document.');
              return this.normalizeEntitlements(cachedAppsData, orgId);
            }
          }
        } catch (fsError) {
          logger.error(`[EntitlementsService] Failed to read cached entitlements from Firestore organization (${orgId}):`, fsError);
        }
      }

      // Fallback 3: Return safe local Starter fallback (never Pro, never free premium/AI)
      logger.debug('[EntitlementsService] No fallbacks available. Relying on default Starter plan limits.');
      return getStarterFallback(orgId);
    }
    })();

    this.activeRequests.set(requestKey, promise);
    try {
      return await promise;
    } finally {
      this.activeRequests.delete(requestKey);
    }
  }

  /**
   * Centralized method to increment monthly imports usage
   */
  public async incrementLibraryImportsUsage(orgId: string): Promise<boolean> {
    if (!orgId) return false;

    let token = '';
    try {
      token = (await auth.currentUser?.getIdToken()) || '';
    } catch (e) {}

    if (!token) {
      try {
        token = ecosystemBridge.getContext()?.token || '';
      } catch (e) {}
    }

    const hostUrl = this.getMillionsNestBaseUrl();
    const endpoint = `${hostUrl}/api/v1/organizations/${orgId}/musicscale/usage/increment`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        logger.info('[EntitlementsService] Monthly library usage increment success.');
        // Invalidate our memory cache so NEXT fetch will reload the incremented usage
        if (this.memoryCache[orgId]) {
          delete this.memoryCache[orgId];
        }
        return true;
      } else {
        const errData = await response.json().catch(() => ({}));
        logger.error('[EntitlementsService] Backend blocked usage increment:', errData);
        if (errData?.error?.includes('limit')) {
          this.logAnalytics('usage_limit_reached', {
            organizationId: orgId,
            feature: 'libraryImports',
          });
        }
        return false;
      }
    } catch (e) {
      logger.error('[EntitlementsService] Connection error during usage increment:', e);
      return false;
    }
  }

  /**
   * Safe UI Logging tracker avoiding PII exposure
   */
  public logAnalytics(eventName: string, payload: Record<string, any>) {
    try {
      const refinedPayload = {
        organizationId: payload.organizationId || '',
        userId: auth.currentUser?.uid || '',
        plan: payload.plan || '',
        feature: payload.feature || '',
        currentUsage: payload.currentUsage ?? null,
        limit: payload.limit ?? null,
        error: payload.error || undefined,
        timestamp: Date.now(),
      };
      
      logger.info(`[Analytics] [${eventName}]`, JSON.stringify(refinedPayload));
    } catch (e) {}
  }
}

export const entitlementsService = EntitlementsService.getInstance();
