import { markStartupMetric } from '../lib/startupTelemetry';
import { logger } from '../lib/logger';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocFromServer, onSnapshot } from 'firebase/firestore';
import type { User, UserProfile, Role, Organization } from '../types';
import { getOrganizationLimits, hasAddon } from '../lib/limits';
import { signOutUser } from '../services/authService';
import { useEcosystem } from './EcosystemContext';
import { entitlementsService, MusicScaleEntitlements } from '../services/entitlementsService';
import { SubscriptionAccessResolution } from '../utils/subscriptionAccessResolver';

interface SubscriptionData {
  status: string;
  plan: string;
  features?: any;
}

export interface AppPermissions {
  manageMembers?: boolean;
  manageOrganizations?: boolean;
  manageOrganization?: boolean;
  manageSongs?: boolean;
  manageScales?: boolean;
  manageBilling?: boolean;
  manageChords?: boolean;
  'musicScale.manageSongs'?: boolean;
  'musicScale.manageScales'?: boolean;
  'musicScale.manageTeams'?: boolean;
  'musicScale.manageRoles'?: boolean;
  'musicscale.songs.edit'?: boolean;
  'musicscale.scales.manage'?: boolean;
  'musicscale.members.manage'?: boolean;
  'musicscale.performance.use'?: boolean;
  'musicscale.chords.edit'?: boolean;
  [key: string]: boolean | undefined;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  userRole: Role | null;
  organization: Organization | null;
  subscription: SubscriptionData | null;
  isSubscriptionLoaded: boolean;
  loading: boolean;
  permissions: AppPermissions | null;
  isOwner: boolean;
  isAdmin: boolean;
  refreshAuthData: () => Promise<void>;
  refreshSubscriptionAccess: () => Promise<SubscriptionAccessResolution>;
  entitlements: MusicScaleEntitlements | null;
  isEntitlementsLoaded: boolean;
  isSupportMode: boolean;
  effectiveOrganizationId: string | null;
  effectiveOrganizationName: string | null;
  hydrationError: string | null;
  supportTargetType?: 'organization' | 'user';
  supportTargetUserId?: string;
  needsRepair: boolean;
  repairReasons: string[];
  isGlobalAdmin: boolean;
  isCurationAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function normalizeGlobalSystemRole(input: any): string {
  if (!input) return "";
  return String(input).trim().toLowerCase();
}

export function isCanonicalGlobalAdminRole(role: string): boolean {
  const normalized = normalizeGlobalSystemRole(role);
  return ["ceo", "global_admin", "ecosystem_owner", "founder"].includes(normalized);
}

export function resolveCanonicalGlobalRole(params: {
  ecoContext?: any;
  userProfile?: any;
}): string {
  if (!params) return "";
  const { ecoContext, userProfile } = params;
  
  const rolesToTry = [
    ecoContext?.ecosystemRole,
    ecoContext?.systemRole,
    userProfile?.systemRole,
    userProfile?.globalRole,
    userProfile?.ecosystemRole
  ];

  for (const role of rolesToTry) {
    if (role && typeof role === "string" && role.trim() !== "") {
      return normalizeGlobalSystemRole(role);
    }
  }

  return "";
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isInitialized: isEcosystemReady, context: ecoContext } = useEcosystem();

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isSubscriptionLoaded, setIsSubscriptionLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [entitlements, setEntitlements] = useState<MusicScaleEntitlements | null>(null);
  const [isEntitlementsLoaded, setIsEntitlementsLoaded] = useState(false);

  // Deriving active context purely from EcosystemContext canonical payload
  const effectiveOrganizationId = ecoContext?.currentOrganizationId || null;
  const effectiveOrganizationName = organization?.name || ecoContext?.currentOrganizationName || 'Sua Organização';
  const roleInOrg = ecoContext?.roleInCurrentOrganization || 'visitor';
  const roleLower = String(roleInOrg).toLowerCase();
  const isOwner = ['owner', 'dono'].includes(roleLower);
  const isAdmin = isOwner || ['admin', 'administrador'].includes(roleLower);
  const needsRepair = !!ecoContext?.needsRepair;
  const repairReasons = ecoContext?.repairReasons || [];

  const permissions: AppPermissions | null = ecoContext?.permissions ? (ecoContext.permissions as unknown as AppPermissions) : null;

  const fetchUserData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) return;
    
    try {
      const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
      let profileData = docSnap.exists() ? (docSnap.data() as UserProfile) : null;
      
      if (!profileData) {
        // Stop entirely if profile is missing (MillionsNest resolves this during Handoff)
        logger.warn("[AuthContext] Local profile missing. Assuming un-onboarded host context.");
        profileData = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          photoURL: currentUser.photoURL || '',
          roleId: 'visitor',
          systemRole: ecoContext?.ecosystemRole || 'user'
        };
      } else {
        // Sync minimal heartbeat in background (fire-and-forget) to not block UI
        setDoc(doc(db, 'users', currentUser.uid), { lastLoginAt: serverTimestamp() }, { merge: true }).catch(()=>{});
      }

      setUserProfile(profileData);
    } catch (e) {
      logger.error("[AuthContext] fetchUserData error", e);
      setUserProfile({
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || '',
        photoURL: currentUser.photoURL || '',
        roleId: 'visitor',
        systemRole: ecoContext?.ecosystemRole || 'user'
      });
    } finally {
      markStartupMetric('auth_profile_completed_ms');
      setLoading(false);
    }
  }, [ecoContext]);

  useEffect(() => {
    if (!isEcosystemReady) return;
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      markStartupMetric('auth_restored_ms');
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchUserData, isEcosystemReady]);

  // Real-time listener for current Organization metadata from Firestore (for UI caching if needed)
  useEffect(() => {
    let unsubscribeOrg: (() => void) | undefined;
    let unsubscribeSub: (() => void) | undefined;
    
    if (effectiveOrganizationId) {
       markStartupMetric('realtime_listeners_started_ms');
       const orgRef = doc(db, 'organizations', effectiveOrganizationId);
       unsubscribeOrg = onSnapshot(orgRef, (docSnap) => {
           if (docSnap.exists()) {
               const orgData = docSnap.data();
               if (orgData.status === 'archived' || orgData.archived === true) {
                   logger.warn("[AuthContext] Organization was archived in real-time. Forcing reload to re-evaluate tenant logic.");
                   // Force hard reload to force EcosystemContext to run its priority tree again
                   window.location.href = '/start'; 
                   return;
               }
               setOrganization({ id: docSnap.id, ...orgData } as any);
           } else {
               setOrganization({
                   id: effectiveOrganizationId,
                   name: effectiveOrganizationName,
                   plan: ecoContext?.plan || 'starter'
               } as any);
           }
       }, (error) => {
           setOrganization({
               id: effectiveOrganizationId,
               name: effectiveOrganizationName,
               plan: ecoContext?.plan || 'starter'
           } as any);
       });

       const subRef = doc(db, 'subscriptions', effectiveOrganizationId);
       unsubscribeSub = onSnapshot(subRef, (docSnap) => {
           if (docSnap.exists()) {
               setSubscription(docSnap.data() as SubscriptionData);
           } else {
               setSubscription(null);
           }
           setIsSubscriptionLoaded(true);
       }, (error) => {
           setIsSubscriptionLoaded(true);
       });
    } else {
       setIsSubscriptionLoaded(true);
    }

    return () => {
        if (unsubscribeOrg) unsubscribeOrg();
        if (unsubscribeSub) unsubscribeSub();
    };
  }, [effectiveOrganizationId]);

  // Entitlements Sync
  useEffect(() => {
    let mounted = true;
    if (effectiveOrganizationId) {
       setIsEntitlementsLoaded(false);
       entitlementsService.fetchEntitlements(effectiveOrganizationId)
         .then(res => {
            if (mounted) {
               setEntitlements(res);
               setIsEntitlementsLoaded(true);
            }
         })
         .catch(() => {
            if (mounted) setIsEntitlementsLoaded(true);
         });
    } else {
       setEntitlements(null);
       setIsEntitlementsLoaded(true);
    }
    return () => { mounted = false; };
  }, [effectiveOrganizationId]);

  const effectiveEntitlements = useMemo(() => {
     if (!entitlements) return null;
     const isGlobalAdmin = isCanonicalGlobalAdminRole(resolveCanonicalGlobalRole({ ecoContext, userProfile }));
     if (isGlobalAdmin) {
       return {
          ...entitlements,
          plan: 'pro' as const,
          status: 'active' as const,
          limits: { users: -1, songs: -1, scales: -1, bandScales: -1, libraryImportsPerMonth: -1 },
          features: {
             basicSongFields: true, richTextLyrics: true, attachments: true, scaleCloning: true,
             scaleHistory: true, aiImport: true, aiSetlistInsights: true, aiCreateScale: true,
             cloudSync: true, priorityNewFeatures: true, unlimitedBandScales: true,
             libraryAccess: true, libraryLimited: true, libraryComplete: true,
          }
       };
     }
     return entitlements;
  }, [entitlements, ecoContext, userProfile]);

    const isGlobalAdmin = isCanonicalGlobalAdminRole(resolveCanonicalGlobalRole({ ecoContext, userProfile }));
    const isCurationAdmin = isGlobalAdmin;

    const value = useMemo(() => ({
    user,
    userProfile,
    userRole,
    organization,
    subscription,
    isSubscriptionLoaded,
    loading: loading || !isEcosystemReady,
    permissions,
    isOwner,
    isAdmin,
    refreshAuthData: async () => { if (user) await fetchUserData(user); },
    refreshSubscriptionAccess: async () => {
      if (!user || !effectiveOrganizationId) {
        return { loaded: true, valid: false, status: 'inactive', reason: 'unauthenticated', retryable: true } as SubscriptionAccessResolution;
      }
      try {
        await user.getIdToken(true);
        entitlementsService.invalidateOrganizationCache(effectiveOrganizationId);
        setIsEntitlementsLoaded(false);
        const res = await entitlementsService.fetchEntitlements(effectiveOrganizationId, true);
        setEntitlements(res);
        setIsEntitlementsLoaded(true);
        
        setIsSubscriptionLoaded(false);
        const subSnap = await getDocFromServer(doc(db, 'subscriptions', effectiveOrganizationId));
        if (subSnap.exists()) {
          setSubscription(subSnap.data() as SubscriptionData);
        } else {
          setSubscription(null);
        }
        setIsSubscriptionLoaded(true);
        let isActive = res.status === 'active' || res.status === 'trialing';
        if (res.status === 'canceled' && res.currentPeriodEnd) {
          const now = Math.floor(Date.now() / 1000);
          const end = typeof res.currentPeriodEnd === 'string' ? parseFloat(res.currentPeriodEnd) : res.currentPeriodEnd;
          if (end > now) isActive = true;
        }
        return { 
          loaded: true, 
          valid: isActive, 
          status: isActive ? 'active' : (res.status as any), 
          reason: 'manual_sync_success', 
          retryable: !isActive 
        } as SubscriptionAccessResolution;
      } catch (e: any) {
        setIsEntitlementsLoaded(true);
        setIsSubscriptionLoaded(true);
        return { loaded: true, valid: false, status: 'error' as any, reason: e.message, technicalError: true, retryable: true } as SubscriptionAccessResolution;
      }
    },
    entitlements: effectiveEntitlements,
    isEntitlementsLoaded,
    isSupportMode: false,
    effectiveOrganizationId,
    effectiveOrganizationName,
    hydrationError: null,
    needsRepair,
    repairReasons,
    isGlobalAdmin,
    isCurationAdmin
  }), [
    user, userProfile, userRole, organization, subscription, isSubscriptionLoaded,
    loading, isEcosystemReady, permissions, isOwner, isAdmin,
    effectiveEntitlements, isEntitlementsLoaded, effectiveOrganizationId,
    effectiveOrganizationName, needsRepair, repairReasons, fetchUserData, isGlobalAdmin, isCurationAdmin
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useFeatures = () => {
    const { userProfile, organization, entitlements, subscription } = useAuth();
    const { context: ecoContext } = useEcosystem();
    
    const isGlobalAdmin = isCanonicalGlobalAdminRole(resolveCanonicalGlobalRole({ ecoContext, userProfile }));
    const activePlan = isGlobalAdmin ? 'pro' : (ecoContext?.plan || organization?.plan || entitlements?.plan || (subscription?.plan === 'pro' ? 'pro' : 'starter'));
    const status = isGlobalAdmin ? 'active' : (entitlements?.status || subscription?.status || 'inactive');
    
    const canAccessGlobalLibrary = () => {
      if (isGlobalAdmin) return true;
      if (entitlements) return !!entitlements.features?.libraryAccess;
      return activePlan === 'pro';
    };
    const canImportGlobalSongs = () => {
      if (isGlobalAdmin) return true;
      if (entitlements) return !!entitlements.features?.libraryLimited || !!entitlements.features?.libraryComplete;
      return activePlan === 'pro';
    };
    const canUseAdvancedFeatures = () => {
      if (isGlobalAdmin) return true;
      if (entitlements) return !!entitlements.features?.libraryAccess;
      return activePlan === 'pro';
    };

    return {
        canAccessGlobalLibrary,
        canImportGlobalSongs,
        canUseAdvancedFeatures,
        effectivePlan: activePlan,
        status,
    };
};

export const useLimits = () => {
    const { userProfile, organization, entitlements, subscription } = useAuth();
    const { context: ecoContext } = useEcosystem();
    
    const isGlobalAdmin = isCanonicalGlobalAdminRole(resolveCanonicalGlobalRole({ ecoContext, userProfile }));
    const activePlan = isGlobalAdmin ? 'pro' : (ecoContext?.plan || organization?.plan || entitlements?.plan || (subscription?.plan === 'pro' ? 'pro' : 'starter'));
    
    const limits = useMemo(() => {
      if (isGlobalAdmin) {
        return { maxMembers: Infinity, maxSongs: Infinity, maxScales: Infinity, maxBandScales: Infinity };
      }
      if (entitlements) {
        return {
          maxMembers: entitlements.limits.users === -1 ? Infinity : entitlements.limits.users,
          maxSongs: entitlements.limits.songs === -1 ? Infinity : entitlements.limits.songs,
          maxScales: entitlements.limits.scales === -1 ? Infinity : entitlements.limits.scales,
          maxBandScales: entitlements.limits.bandScales === -1 ? Infinity : entitlements.limits.bandScales,
        };
      }
      return getOrganizationLimits(activePlan === 'pro' ? 'pro' : 'starter');
    }, [entitlements, activePlan, isGlobalAdmin]);

    const checkAddon = (addonCode: string) => hasAddon(organization?.addons, addonCode);

    return { limits, checkAddon, effectivePlan: activePlan === 'pro' ? 'pro' : 'free' };
};
