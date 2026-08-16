import { resolveMusicScaleMemberProfile } from './musicScaleMemberProjection.js';

export type AiFeature =
  | "aiImport"
  | "aiStructuring"
  | "aiSuggestions"
  | "aiSetlistAnalysis";

export type AiPermission =
  | "canManageRepertoire"
  | "canManageChords";

export interface AuthorizeAiRequestInput {
  authHeader?: string;
  organizationId?: string;
  claimedUserId?: string;
  requiredFeature: AiFeature;
  requiredAnyPermissions: AiPermission[];
  dbInstance: any;
  authInstance: any;
}

export interface AiAuthorizedContext {
  uid: string;
  email: string | null;
  organizationId: string;
  systemRole: string | null;
  isGlobal: boolean;
  isOwner: boolean;
  organizationRole: string | null;
  roleId: string | null;
}

export type AiAuthResult =
  | { ok: true; context: AiAuthorizedContext }
  | { ok: false; statusCode: number; error: string };

function aggregateCapabilities(...sources: any[]): Set<string> {
  const result = new Set<string>();
  for (const source of sources) {
    if (source == null) continue;
    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === 'string') {
          const val = item.trim();
          if (val) result.add(val);
        }
      }
    } else if (typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        if (value === true && typeof key === 'string') {
          const val = key.trim();
          if (val) result.add(val);
        }
      }
    }
  }
  return result;
}

function resolveOrganizationRole(data: any): string | null {
  const canonical = typeof data?.organizationRole === "string"
    ? data.organizationRole.trim().toLowerCase()
    : "";

  if (canonical) return canonical;

  const legacy = typeof data?.role === "string"
    ? data.role.trim().toLowerCase()
    : "";

  return legacy || null;
}

export interface ResolveAiEntitlementInput {
  orgData: any;
  requiredFeature: AiFeature;
  isGlobal: boolean;
}

export function resolveAiEntitlement({ orgData, requiredFeature, isGlobal }: ResolveAiEntitlementInput): { ok: true } | { ok: false; statusCode: number; error: string } {
  if (isGlobal) return { ok: true };
  
  try {
    const appsData = orgData?.apps;
    const hasCanonicalMusicScale = appsData != null && typeof appsData === 'object' && Object.prototype.hasOwnProperty.call(appsData, 'musicscale');

    if (hasCanonicalMusicScale) {
      const appEntitlement = appsData.musicscale;
      if (!appEntitlement || typeof appEntitlement !== 'object' || Array.isArray(appEntitlement)) {
        return { ok: false, statusCode: 403, error: "FEATURE_NOT_ENTITLED" };
      }
      
      const status = String(appEntitlement.status || "").trim().toLowerCase();
      if (!['active', 'trial', 'trialing'].includes(status)) {
        return { ok: false, statusCode: 403, error: "FEATURE_NOT_ENTITLED" };
      }
      
      if (appEntitlement.features?.[requiredFeature] !== true) {
        return { ok: false, statusCode: 403, error: "FEATURE_NOT_ENTITLED" };
      }
      return { ok: true };
    } else {
      let legacyPlan = String(orgData?.music_scale_plan || orgData?.plan || "").trim().toLowerCase();
      if (legacyPlan === 'premium' || legacyPlan === 'pro_unlimited') legacyPlan = 'pro';
      if (legacyPlan === 'medium' || legacyPlan === 'advanced_features') legacyPlan = 'advanced';

      const legacySubStatus = String(orgData?.subscriptionStatus || orgData?.subscription_status || "").trim().toLowerCase();
      if (['past_due', 'canceled', 'cancelled', 'expired', 'inactive', 'unpaid', 'incomplete', 'incomplete_expired'].includes(legacySubStatus)) {
         return { ok: false, statusCode: 403, error: "FEATURE_NOT_ENTITLED" };
      }

      if (legacyPlan !== 'pro') {
         return { ok: false, statusCode: 403, error: "FEATURE_NOT_ENTITLED" };
      }
      
      // Legacy 'pro' grants aiImport and aiStructuring
      if (requiredFeature !== 'aiImport' && requiredFeature !== 'aiStructuring') {
         return { ok: false, statusCode: 403, error: "FEATURE_NOT_ENTITLED" };
      }
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, statusCode: 503, error: "ENTITLEMENT_SERVICE_UNAVAILABLE" };
  }
}

export async function authorizeAiRequest(input: AuthorizeAiRequestInput): Promise<AiAuthResult> {
  const { authHeader, organizationId, claimedUserId, requiredFeature, requiredAnyPermissions, dbInstance, authInstance } = input;

  if (!dbInstance || !authInstance) {
    return { ok: false, statusCode: 503, error: "SERVICE_UNAVAILABLE" };
  }

  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.length <= 7) {
    return { ok: false, statusCode: 401, error: "UNAUTHORIZED" };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { ok: false, statusCode: 401, error: "UNAUTHORIZED" };
  }

  let decodedToken;
  try {
    decodedToken = await authInstance.verifyIdToken(token, true);
  } catch (e) {
    return { ok: false, statusCode: 401, error: "UNAUTHORIZED" };
  }

  const uid = decodedToken.uid;
  if (!uid) {
    return { ok: false, statusCode: 401, error: "UNAUTHORIZED" };
  }

  if (claimedUserId && claimedUserId !== uid) {
    return { ok: false, statusCode: 403, error: "ACTOR_ID_MISMATCH" };
  }

  let userDoc;
  try {
    userDoc = await dbInstance.collection('users').doc(uid).get();
  } catch (e) {
    return { ok: false, statusCode: 503, error: "SERVICE_UNAVAILABLE" };
  }

  if (!userDoc.exists) {
    return { ok: false, statusCode: 403, error: "FORBIDDEN" };
  }

  const userData = userDoc.data();
  const rawSystemRole = String(userData?.systemRole || "").trim().toLowerCase();
  
  let isGlobal = false;
  let systemRole: string | null = null;
  if (["ceo", "global_admin", "ecosystem_owner", "founder"].includes(rawSystemRole)) {
    isGlobal = true;
    systemRole = rawSystemRole;
  }

  if (!organizationId || !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) {
    return { ok: false, statusCode: 400, error: "INVALID_ORGANIZATION_ID" };
  }

  let orgDoc;
  try {
    orgDoc = await dbInstance.collection('organizations').doc(organizationId).get();
  } catch (e) {
    return { ok: false, statusCode: 503, error: "SERVICE_UNAVAILABLE" };
  }

  if (!orgDoc.exists) {
    return { ok: false, statusCode: 404, error: "ORGANIZATION_NOT_FOUND" };
  }

  const orgData = orgDoc.data();
  const orgStatus = String(orgData?.status || "").trim().toLowerCase();
  if (orgStatus === 'archived' || orgData?.archived === true) {
    return { ok: false, statusCode: 403, error: "FORBIDDEN" };
  }

  let isOwner = false;
  if (orgData?.ownerUid === uid || orgData?.ownerUserId === uid || orgData?.ownerId === uid) {
    isOwner = true;
  }

  let isActiveMember = false;
  let organizationRole: string | null = null;
  let roleId: string | null = null;
  let membershipSources: any[] = [];
  let canonicalMembershipData: any = null;

  if (isGlobal) {
    isActiveMember = true;
  } else {
    // Check canonical first
    let canonDoc;
    try {
      canonDoc = await dbInstance.collection('organizations').doc(organizationId).collection('members').doc(uid).get();
    } catch (e) {
      return { ok: false, statusCode: 503, error: "SERVICE_UNAVAILABLE" };
    }

    if (canonDoc.exists) {
      const cData = canonDoc.data();
      const st = String(cData?.status || "").trim().toLowerCase();
      if (st === 'active' || st === 'ativo') {
        isActiveMember = true;
        canonicalMembershipData = cData;
        organizationRole = resolveOrganizationRole(cData);
        membershipSources.push(cData?.capabilities, cData?.permissions, cData?.effectiveCapabilities);
      }
    } else {
      // Check legacy
      let legacyDocs1, legacyDocs2;
      try {
        legacyDocs1 = await dbInstance.collection('organization_members').doc(`${uid}_${organizationId}`).get();
        legacyDocs2 = await dbInstance.collection('organization_members').doc(`${organizationId}_${uid}`).get();
      } catch (e) {
         return { ok: false, statusCode: 503, error: "SERVICE_UNAVAILABLE" };
      }
      
      let legacyDoc = null;
      if (legacyDocs1 && legacyDocs1.exists) {
         legacyDoc = legacyDocs1;
      } else if (legacyDocs2 && legacyDocs2.exists) {
         legacyDoc = legacyDocs2;
      }

      if (legacyDoc) {
        const lData = legacyDoc.data();
        const st = String(lData?.status || "").trim().toLowerCase();
        if (st === 'active' || st === 'ativo') {
          isActiveMember = true;
          organizationRole = resolveOrganizationRole(lData);
          membershipSources.push(lData?.capabilities, lData?.permissions, lData?.effectiveCapabilities);
        }
      }
    }
  }

  if (isOwner) {
     isActiveMember = true;
     organizationRole = 'owner';
  }

  if (!isActiveMember) {
    return { ok: false, statusCode: 403, error: "FORBIDDEN" };
  }

  try {
    roleId = (await resolveMusicScaleMemberProfile(dbInstance, organizationId, uid, canonicalMembershipData)).roleId;
  } catch (e) {
    return { ok: false, statusCode: 503, error: "SERVICE_UNAVAILABLE" };
  }

  // INTERNAL PERMISSIONS
  let hasInternalPermission = false;
  if (isGlobal || isOwner || organizationRole === 'admin' || organizationRole === 'owner') {
    hasInternalPermission = true;
  } else {
    if (requiredAnyPermissions && requiredAnyPermissions.length > 0) {
       let rolePermissions: any = {};
       let roleCapabilities: any = {};
       if (roleId) {
         let roleDoc;
         try {
           roleDoc = await dbInstance.collection('roles').doc(roleId).get();
           if (roleDoc.exists) {
             const rData = roleDoc.data();
             if (rData?.organizationId === organizationId) {
                rolePermissions = rData?.permissions;
                roleCapabilities = rData?.capabilities;
             }
           }
         } catch(e) {
           return { ok: false, statusCode: 403, error: "FORBIDDEN" }; 
         }
       }
       
       const aggregatedCaps = aggregateCapabilities(
          ...membershipSources,
          rolePermissions,
          roleCapabilities
       );
       
       for (const perm of requiredAnyPermissions) {
         if (perm === 'canManageRepertoire') {
           if (aggregatedCaps.has('canManageRepertoire') || 
               aggregatedCaps.has('manageSongs') ||
               aggregatedCaps.has('musicScale.manageSongs') ||
               aggregatedCaps.has('musicscale.songs.edit')) {
                 hasInternalPermission = true; break;
           }
         }
         
         if (perm === 'canManageChords') {
           if (aggregatedCaps.has('canManageChords') ||
               aggregatedCaps.has('manageChords') ||
               aggregatedCaps.has('musicscale.chords.edit')) {
                 hasInternalPermission = true; break;
           }
         }
       }
    } else {
       hasInternalPermission = false;
    }
  }

  if (!hasInternalPermission) {
    return { ok: false, statusCode: 403, error: "FORBIDDEN" };
  }

  // ENTITLEMENTS
  const entitlementResult = resolveAiEntitlement({ orgData, requiredFeature, isGlobal });
  if (!entitlementResult.ok) {
    const err = entitlementResult as { ok: false, statusCode: number, error: string };
    return { ok: false, statusCode: err.statusCode, error: err.error };
  }

  const context: AiAuthorizedContext = {
    uid,
    email: decodedToken.email || null,
    organizationId,
    systemRole,
    isGlobal,
    isOwner,
    organizationRole,
    roleId
  };

  return { ok: true, context };
}

export interface AiRateLimiterOptions {
  clock?: () => number;
}

export interface RateLimiterAcquireInput {
  uid: string;
  organizationId: string;
  endpointKey: string;
}

export interface RateLimitEntry {
  activeConnections: number;
  acquisitions: number[];
}

export class InMemoryAiRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private maxKeys: number = 5000;
  private clock: () => number;
  private limits: Record<string, { maxAcquisitions: number; windowMs: number }> = {
    'ai-import': { maxAcquisitions: 10, windowMs: 10 * 60 * 1000 },
    'fix-chords': { maxAcquisitions: 20, windowMs: 10 * 60 * 1000 }
  };

  constructor(options?: AiRateLimiterOptions) {
    this.clock = options?.clock || (() => Date.now());
  }

  acquire(input: RateLimiterAcquireInput): { ok: true; release: () => void } | { ok: false; statusCode: 429; error: "AI_RATE_LIMITED" } {
    const key = `${input.uid}:${input.organizationId}:${input.endpointKey}`;
    const now = this.clock();
    const limitConfig = this.limits[input.endpointKey] || { maxAcquisitions: 10, windowMs: 10 * 60 * 1000 };

    this.cleanup(now);

    if (this.store.size >= this.maxKeys && !this.store.has(key)) {
      this.evict(now);
      if (this.store.size >= this.maxKeys) {
        return { ok: false, statusCode: 429, error: "AI_RATE_LIMITED" };
      }
    }

    let entry = this.store.get(key);
    if (!entry) {
      entry = { activeConnections: 0, acquisitions: [] };
      this.store.set(key, entry);
    }

    entry.acquisitions = entry.acquisitions.filter(t => now - t <= limitConfig.windowMs);

    if (entry.activeConnections >= 2) {
      return { ok: false, statusCode: 429, error: "AI_RATE_LIMITED" };
    }

    if (entry.acquisitions.length >= limitConfig.maxAcquisitions) {
      return { ok: false, statusCode: 429, error: "AI_RATE_LIMITED" };
    }

    entry.activeConnections++;
    entry.acquisitions.push(now);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const currentEntry = this.store.get(key);
      if (currentEntry) {
        if (currentEntry.activeConnections > 0) {
          currentEntry.activeConnections--;
        }
      }
    };

    return { ok: true, release };
  }

  private cleanup(now: number) {
    for (const [key, entry] of this.store.entries()) {
      const endpointKey = key.split(':')[2];
      const limitConfig = this.limits[endpointKey] || { maxAcquisitions: 10, windowMs: 10 * 60 * 1000 };
      entry.acquisitions = entry.acquisitions.filter(t => now - t <= limitConfig.windowMs);
      
      if (entry.activeConnections === 0 && entry.acquisitions.length === 0) {
        this.store.delete(key);
      }
    }
  }

  private evict(now: number) {
    this.cleanup(now);
    if (this.store.size < this.maxKeys) return;

    const idleEntries = Array.from(this.store.entries()).filter(([_, entry]) => entry.activeConnections === 0);
    idleEntries.sort((a, b) => {
      const latestA = a[1].acquisitions.length > 0 ? Math.max(...a[1].acquisitions) : 0;
      const latestB = b[1].acquisitions.length > 0 ? Math.max(...b[1].acquisitions) : 0;
      return latestA - latestB;
    });

    for (const [key] of idleEntries) {
      this.store.delete(key);
      if (this.store.size < this.maxKeys) return;
    }
  }

  _getKeysCount() {
    return this.store.size;
  }
  
  _clear() {
    this.store.clear();
  }
}
