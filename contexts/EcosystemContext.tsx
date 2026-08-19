import { markStartupMetric } from '../lib/startupTelemetry';
import React, { createContext, useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { ecosystemBridge } from '../services/ecosystem/EcosystemBridge';
import { consumeHandoff } from '../services/ecosystem/handoffHelper';
import { EcosystemContextPayload, EcosystemEvent } from '../services/ecosystem/types';
import Spinner from '../components/common/Spinner';
import { useAuth } from './AuthContext'; // Optionally use AuthContext to sign out on local side, but AuthContext also has access to ecosystem
import { auth } from '../services/firebase'; // Actually, since we'll just invalidate session locally
import { onAuthStateChanged } from 'firebase/auth';
import { getCandidateOrganizationIds, isValidCanonicalResponse, isGlobalOrganizationCatalogRole } from '../services/ecosystem/startupFastPath';
import { canManageMusicScales, canManageBandScales, canManageSongs, hasMusicScaleCapability } from '../utils/rbac';

interface EcosystemContextValue {
  isInitialized: boolean;
  isContextSyncing: boolean;
  context: EcosystemContextPayload | null;
  publishEvent: (event: EcosystemEvent) => void;
  navigateToEcosystem: (path?: string) => void;
  isStandalone: boolean;
  isDegraded: boolean;
  switchOrganization: (orgId: string) => Promise<boolean>;
}

const EcosystemContext = createContext<EcosystemContextValue>({
  isInitialized: false,
  isContextSyncing: false,
  context: null,
  publishEvent: () => {},
  navigateToEcosystem: () => {},
  isStandalone: false,
  isDegraded: false,
  switchOrganization: async () => false,
});

export const useEcosystem = () => useContext(EcosystemContext);

const DENIED_PERMISSIONS = {
  canManageOrganization: false,
  canManageMembers: false,
  canManageScales: false,
  canManageRepertoire: false,
  canManageChords: false,
};

const getCanonicalPermissions = (serverContext: any) => {
  const accessContext = serverContext?.effectiveContext;
  if (!accessContext) return DENIED_PERMISSIONS;
  const membershipStatus = String(accessContext.membershipStatus || serverContext.membershipStatus || '').toLowerCase();
  if (!accessContext.isGlobalAccess && !['active', 'ativo'].includes(membershipStatus)) {
    return DENIED_PERMISSIONS;
  }

  const normalizedAccessContext = {
    ...accessContext,
    capabilities: accessContext.capabilities instanceof Set
      ? accessContext.capabilities
      : new Set(accessContext.effectiveCapabilities || []),
  };

  return {
    canManageOrganization: hasMusicScaleCapability(normalizedAccessContext, 'organization.settings.manage'),
    canManageMembers: hasMusicScaleCapability(normalizedAccessContext, 'organization.members.manage'),
    canManageScales: canManageMusicScales(normalizedAccessContext) || canManageBandScales(normalizedAccessContext),
    canManageRepertoire: canManageSongs(normalizedAccessContext),
    canManageChords: canManageSongs(normalizedAccessContext),
  };
};

const getSanitizedContextCache = (context: any) => ({
  uid: context.uid,
  displayName: context.displayName,
  ecosystemRole: context.ecosystemRole,
  currentOrganizationId: context.currentOrganizationId,
  currentOrganizationName: context.currentOrganizationName,
  roleInCurrentOrganization: context.roleInCurrentOrganization,
  plan: context.plan,
  subscriptionStatus: context.subscriptionStatus,
  organizationsAvailable: context.organizationsAvailable,
});

export const EcosystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isContextSyncing, setIsContextSyncing] = useState(false);
  const [context, setContext] = useState<EcosystemContextPayload | null>(null);
  const [isDegraded, setIsDegraded] = useState(false);
  const switchGeneration = useRef(0);
  const contextRef = useRef<EcosystemContextPayload | null>(null);
  const releasedCanonicalOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    let mounted = true;
    let unsubscribeAuth: any = null;
    let activeControllers: AbortController[] = [];
    let activeGeneration = 0;

    const bootstrapModule = async () => {
      markStartupMetric('ecosystem_context_started_ms');
      try {
        await consumeHandoff();
        
        const payload = await ecosystemBridge.initialize();
        if (!mounted) return;

        if (payload.isStandalone) {
           if (mounted) setContext(payload);
           
           // If standalone, we must sync the real user context from the backend whenever auth changes.
           unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
               ++switchGeneration.current;
               releasedCanonicalOrgIdRef.current = null;
               const currentGeneration = ++activeGeneration;
               if (user) {
                   if (mounted) setIsContextSyncing(true);
                   try {
                       // Replace backend fetch with client-side fetch to bypass Admin SDK issues in dev
                       const { db } = await import('../services/firebase');
                       const { doc, getDoc, collection, collectionGroup, query, where, getDocs } = await import('firebase/firestore');
                       
                       let orgId = null;
                       let orgName = 'Carregando Organização...';
                       let roleInOrg = 'visitor';
                       let plan = 'starter';
                       let status = 'inactive';
                       let organizationsAvailable: any[] = [];
                       let systemRole = 'user';
                       let displayName = user.displayName || '';

                       const userSnap = await getDoc(doc(db, 'users', user.uid));
                       let userHasActive = null;
                       let userHasPrimary = null;
                       let userHasLegacy = null;

                       if (userSnap.exists()) {
                           const userData = userSnap.data();
                           userHasActive = userData.activeOrganizationId;
                           userHasPrimary = userData.primaryOrganizationId;
                           userHasLegacy = userData.organizationId;
                           systemRole = userData.systemRole || 'user';
                           displayName = userData.displayName || displayName;
                           roleInOrg = userData.organizationRole || userData.role || roleInOrg;
                       }
                       markStartupMetric('ecosystem_user_profile_completed_ms');

                       let earlyGlobalCatalogPromise: Promise<any> | null = null;
                       if (isGlobalOrganizationCatalogRole(systemRole)) {
                           earlyGlobalCatalogPromise = getDocs(collection(db, 'organizations')).catch((e) => {
                               console.warn("Global admin early catalog fetch failed:", e);
                               return null;
                           });
                       }

                       const localActiveOrg = localStorage.getItem('activeOrganizationId');
                       const candidates = getCandidateOrganizationIds(localActiveOrg, userHasActive, userHasPrimary, userHasLegacy);
                       const candidateOrgId = candidates.length > 0 ? candidates[0] : null;

                       let earlyCanonicalPromise: Promise<any> | null = null;
                       let earlyTokenPromise: Promise<string> | null = null;
                       let earlyOrgDocPromise: Promise<any> | null = null;
                       let earlyAbortController: AbortController | null = null;
                       let earlyTimeoutId: any = null;

                       if (candidateOrgId && candidateOrgId !== 'offline_default') {
                           earlyAbortController = new AbortController();
                           activeControllers.push(earlyAbortController);
                           
                           earlyOrgDocPromise = getDoc(doc(db, 'organizations', candidateOrgId)).catch(() => null);
                           earlyTokenPromise = user.getIdToken(false).catch(() => '');
                           
                           markStartupMetric('ecosystem_access_context_started_ms');
                           earlyTimeoutId = setTimeout(() => earlyAbortController?.abort(), 5000);
                           earlyCanonicalPromise = earlyTokenPromise.then(async token => {
                               if (!token || !mounted || earlyAbortController?.signal.aborted || currentGeneration !== activeGeneration) return null;
                               const response = await fetch(`/api/v1/ecosystem/access-context?organizationId=${candidateOrgId}`, {
                                   headers: { 'Authorization': `Bearer ${token}` },
                                   signal: earlyAbortController.signal
                               }).catch(() => null);
                               if (!response?.ok) return null;
                               return response.json().catch(() => null);
                           }).finally(() => { clearTimeout(earlyTimeoutId); });

                           void earlyCanonicalPromise.then((canonicalContext) => {
                               if (
                                 !isValidCanonicalResponse(canonicalContext, user.uid, candidateOrgId) ||
                                 canonicalContext.effectiveContext?.resolutionStatus !== 'resolved' ||
                                 (!canonicalContext.effectiveContext?.isGlobalAccess &&
                                   !['active', 'ativo'].includes(String(
                                     canonicalContext.effectiveContext?.membershipStatus || canonicalContext.membershipStatus || ''
                                   ).toLowerCase())) ||
                                 !mounted ||
                                 currentGeneration !== activeGeneration ||
                                 auth.currentUser?.uid !== user.uid
                               ) return;

                               releasedCanonicalOrgIdRef.current = candidateOrgId;
                               const canonicalRole = canonicalContext.organizationRole || canonicalContext.effectiveContext?.organizationRole || 'visitor';
                               const initialOrganization = {
                                   id: candidateOrgId,
                                   name: candidateOrgId,
                                   role: canonicalRole,
                               };

                               setContext((previous: any) => ({
                                   ...payload,
                                   uid: user.uid,
                                   email: user.email,
                                   displayName,
                                   ecosystemRole: canonicalContext.systemRole || systemRole,
                                   currentOrganizationId: candidateOrgId,
                                   currentOrganizationName: candidateOrgId,
                                   roleInCurrentOrganization: canonicalRole,
                                   organizationsAvailable: [initialOrganization],
                                   serverContext: canonicalContext,
                                   isStandalone: true,
                                   permissions: getCanonicalPermissions(canonicalContext),
                               }));
                               setIsDegraded(false);
                               setIsContextSyncing(false);
                               setIsInitialized(true);
                               markStartupMetric('ecosystem_access_context_completed_ms');
                               markStartupMetric('ecosystem_context_completed_ms', { standalone: true });
                           }).catch(() => {
                               // Discovery and the existing least-privilege fallback remain responsible for failures.
                           });
                       }

                       const getReusableOrganizationSnapshot = async (targetOrgId: string) => {
                           if (targetOrgId === candidateOrgId && earlyOrgDocPromise) {
                               try {
                                   const snap = await earlyOrgDocPromise;
                                   if (
                                     snap &&
                                     typeof snap.exists === 'function' &&
                                     snap.exists()
                                   ) {
                                     return snap;
                                   }
                               } catch (e) {}
                           }
                           return getDoc(doc(db, 'organizations', targetOrgId)).catch(() => null);
                       };

                       // Function to check if an org is valid
                       let organizationsMap = new Map();
                       const checkAndAddOrg = async (idToTest: string, roleToSet: string, setActive: boolean = false) => {
                           if (!idToTest || organizationsMap.has(idToTest)) return false;
                           organizationsMap.set(idToTest, true);
                           try {
                               let orgSnap = await getReusableOrganizationSnapshot(idToTest);
                               if (orgSnap && orgSnap.exists && orgSnap.exists()) {
                                   const orgData = orgSnap.data();
                                   let resolvedRole = roleToSet;
                                    // Precedence 1: Check if user is the explicit owner on the organization document
                                     const isOrgOwner = orgData.ownerUid === user.uid || 
                                                        orgData.ownerUserId === user.uid || 
                                                        orgData.ownerId === user.uid || 
                                                        orgData.owner_user_id === user.uid;
                                     if (isOrgOwner) {
                                         resolvedRole = 'owner';
                                     } else {
                                         // Precedence 2: Check global transversal collection organization_members
                                         let foundInGlobal = false;
                                         try {
                                             const gDoc1 = await getDoc(doc(db, 'organization_members', `${user.uid}_${idToTest}`));
                                             if (gDoc1.exists()) {
                                                 const gd = gDoc1.data();
                                                 resolvedRole = gd.role || gd.organizationRole || gd.musicscaleRole || resolvedRole;
                                                 foundInGlobal = true;
                                             } else {
                                                 const gDoc2 = await getDoc(doc(db, 'organization_members', `${idToTest}_${user.uid}`));
                                                 if (gDoc2.exists()) {
                                                     const gd = gDoc2.data();
                                                     resolvedRole = gd.role || gd.organizationRole || gd.musicscaleRole || resolvedRole;
                                                     foundInGlobal = true;
                                                 }
                                             }
                                         } catch (ge) {
                                             console.warn("[EcosystemContext] Failed to check global organization_members:", ge);
                                         }

                                         // Precedence 3: Check dynamic organization members subcollection
                                         if (!foundInGlobal || resolvedRole === 'visitor' || !resolvedRole) {
                                             try {
                                                 const memDoc = await getDoc(doc(db, 'organizations', idToTest, 'members', user.uid));
                                                 if (memDoc.exists()) {
                                                     const md = memDoc.data();
                                                     resolvedRole = md.organizationRole || md.musicscaleRole || md.role || md.ministryFunction || resolvedRole;
                                                 }
                                             } catch (me) {
                                                 console.warn("[EcosystemContext] Failed to check subcollection membership:", me);
                                             }
                                         }
                                     }
                                    if (orgData.status !== 'archived' && orgData.archived !== true) {
                                       if (setActive && !orgId) {
                                           orgId = idToTest;
                                           orgName = orgData.name || orgName;
                                           plan = orgData.music_scale_plan || orgData.plan || 'starter';
                                           roleInOrg = resolvedRole;
                                       }
                                       organizationsAvailable.push({ id: idToTest, name: orgData.name || 'Minha Organização', role: resolvedRole });
                                       return true;
                                   }
                               }
                           } catch (err) {
                               console.warn("Failed to check org", err);
                           }
                           return false; // mark true to prevent re-fetching later if it was loaded but archived? We already put it in organizationsMap.
                       };
                       
                       // 1. Gather all possible IDs first (memberships, owned, etc) with deep safety try-catch wrappers
                        let ownedOrgs: any[] = [];
                        let membershipOrgs: any[] = [];

                        const queries = [
                            getDocs(query(collection(db, 'organizations'), where('ownerUid', '==', user.uid))),
                            getDocs(query(collection(db, 'organizations'), where('ownerUserId', '==', user.uid))),
                            getDocs(query(collectionGroup(db, 'members'), where('uid', '==', user.uid))),
                            getDocs(query(collectionGroup(db, 'members'), where('userId', '==', user.uid))),
                            getDocs(query(collection(db, 'organization_members'), where('uid', '==', user.uid))),
                            getDocs(query(collection(db, 'organization_members'), where('userId', '==', user.uid))),
                            getDocs(query(collection(db, 'organization_members'), where('user_id', '==', user.uid)))
                        ];

                        const results = await Promise.allSettled(queries);
                        markStartupMetric('ecosystem_org_discovery_completed_ms');

                        if (results[0].status === 'fulfilled') {
                            for (const orgDoc of results[0].value.docs) {
                                ownedOrgs.push(orgDoc);
                            }
                        } else {
                            console.warn("[MusicScale Ecosystem] Failed to query owned orgs by ownerUid (expected if rules/indices not fully set):", results[0].reason);
                        }

                        if (results[1].status === 'fulfilled') {
                            for (const orgDoc of results[1].value.docs) {
                                if (!ownedOrgs.some(o => o.id === orgDoc.id)) {
                                    ownedOrgs.push(orgDoc);
                                }
                            }
                        } else {
                            console.warn("[MusicScale Ecosystem] Failed to query owned orgs by ownerUserId (expected if rules/indices not fully set):", results[1].reason);
                        }

                        if (results[2].status === 'fulfilled') {
                            for (const mDoc of results[2].value.docs) {
                                membershipOrgs.push(mDoc.data());
                            }
                        }

                        if (results[3].status === 'fulfilled') {
                            for (const mDoc of results[3].value.docs) {
                                const mData = mDoc.data();
                                const mOrgId = mData.organizationId || mData.organization_id;
                                if (mOrgId && !membershipOrgs.some(o => (o.organizationId || o.organization_id) === mOrgId)) {
                                    membershipOrgs.push(mData);
                                }
                            }
                        }

                        if (results[4].status === 'fulfilled') {
                            for (const mDoc of results[4].value.docs) {
                                const mData = mDoc.data();
                                const mOrgId = mData.organizationId || mData.organization_id;
                                if (mOrgId && !membershipOrgs.some(o => (o.organizationId || o.organization_id) === mOrgId)) {
                                    membershipOrgs.push(mData);
                                }
                            }
                        }

                        if (results[5].status === 'fulfilled') {
                            for (const mDoc of results[5].value.docs) {
                                const mData = mDoc.data();
                                const mOrgId = mData.organizationId || mData.organization_id;
                                if (mOrgId && !membershipOrgs.some(o => (o.organizationId || o.organization_id) === mOrgId)) {
                                    membershipOrgs.push(mData);
                                }
                            }
                        }

                        if (results[6].status === 'fulfilled') {
                            for (const mDoc of results[6].value.docs) {
                                const mData = mDoc.data();
                                const mOrgId = mData.organizationId || mData.organization_id;
                                if (mOrgId && !membershipOrgs.some(o => (o.organizationId || o.organization_id) === mOrgId)) {
                                    membershipOrgs.push(mData);
                                }
                            }
                        }

                        // Dynamic CEO check from canonical user profile systemRole
                        if (isGlobalOrganizationCatalogRole(systemRole)) {
                            systemRole = 'ceo';
                            try {
                                const allOrgsSnap = await earlyGlobalCatalogPromise;
                                
                                if (allOrgsSnap && allOrgsSnap.docs) {
                                    for (const orgDoc of allOrgsSnap.docs) {
                                        const orgData = orgDoc.data();
                                        if (orgData.status !== 'archived' && orgData.archived !== true) {
                                            if (!organizationsMap.has(orgDoc.id)) {
                                                organizationsMap.set(orgDoc.id, true);
                                                const isExplicitOwner =
                                                    orgData.ownerUid === user.uid ||
                                                    orgData.ownerUserId === user.uid ||
                                                    orgData.ownerId === user.uid ||
                                                    orgData.owner_user_id === user.uid;
                                                const catalogRole = isExplicitOwner ? 'owner' : 'global_access';
                                                organizationsAvailable.push({ id: orgDoc.id, name: orgData.name || 'Organização', role: catalogRole });
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.warn("Global admin failed to load all orgs:", err);
                            }
                        }

                        // Load them
                        for (const orgDoc of ownedOrgs) {
                            const orgData = orgDoc.data();
                            if (orgData.status !== 'archived' && orgData.archived !== true) {
                                organizationsMap.set(orgDoc.id, true);
                                const isExplicitOwner =
                                    orgData.ownerUid === user.uid ||
                                    orgData.ownerUserId === user.uid ||
                                    orgData.ownerId === user.uid ||
                                    orgData.owner_user_id === user.uid;
                                const catalogRole = isExplicitOwner ? 'owner' : 'global_access';
                                organizationsAvailable.push({ id: orgDoc.id, name: orgData.name || 'Minha Organização', role: catalogRole });
                            }
                        }
                        for (const mData of membershipOrgs) {
                            const mOrgId = mData.organizationId || mData.organization_id;
                            const mRole = mData.organizationRole || mData.role || 'visitor';
                            if (mOrgId && !organizationsMap.has(mOrgId)) {
                                await checkAndAddOrg(mOrgId, mRole, false);
                            }
                        }

                        // Proactively load known organizations via direct doc fetch (bypasses any index/group query failures)
                        if (userHasActive && !organizationsMap.has(userHasActive)) {
                            await checkAndAddOrg(userHasActive, roleInOrg || 'member', false);
                        }
                        if (userHasPrimary && !organizationsMap.has(userHasPrimary)) {
                            await checkAndAddOrg(userHasPrimary, roleInOrg || 'member', false);
                        }
                        if (userHasLegacy && !organizationsMap.has(userHasLegacy)) {
                            await checkAndAddOrg(userHasLegacy, roleInOrg || 'member', false);
                        }

                        // Now decide WHICH one is active
                        // If active is present, we try to set it
                        const localActive = localStorage.getItem('activeOrganizationId');
                        if (localActive && organizationsAvailable.some(o => o.id === localActive)) {
                            const activeMatch = organizationsAvailable.find(o => o.id === localActive);
                            orgId = activeMatch.id;
                            orgName = activeMatch.name;
                            roleInOrg = activeMatch.role;
                            try {
                                const getPl = await getReusableOrganizationSnapshot(orgId);
                                plan = (getPl && getPl.exists && getPl.exists()) ? (getPl.data().music_scale_plan || getPl.data().plan || 'starter') : 'starter';
                            } catch (error) {
                                console.warn("Failed to fetch active organization plan directly:", error);
                            }
                        } else if (userHasActive && organizationsAvailable.some(o => o.id === userHasActive)) {
                            const activeMatch = organizationsAvailable.find(o => o.id === userHasActive);
                            orgId = activeMatch.id;
                            orgName = activeMatch.name;
                            roleInOrg = activeMatch.role;
                            try {
                                const getPl = await getReusableOrganizationSnapshot(orgId);
                                plan = (getPl && getPl.exists && getPl.exists()) ? (getPl.data().music_scale_plan || getPl.data().plan || 'starter') : 'starter';
                            } catch (error) {
                                console.warn("Failed to fetch userHasActive organization plan directly:", error);
                            }
                            localStorage.setItem('activeOrganizationId', activeMatch.id);
                        } else if (userHasPrimary && organizationsAvailable.some(o => o.id === userHasPrimary)) {
                            const activeMatch = organizationsAvailable.find(o => o.id === userHasPrimary);
                            if (activeMatch) {
                                orgId = activeMatch.id;
                                orgName = activeMatch.name;
                                roleInOrg = activeMatch.role;
                                try {
                                    const getPl = await getReusableOrganizationSnapshot(orgId);
                                    plan = (getPl && getPl.exists && getPl.exists()) ? (getPl.data().music_scale_plan || getPl.data().plan || 'starter') : 'starter';
                                } catch (error) {
                                    console.warn("Failed to fetch userHasPrimary organization plan directly:", error);
                                }
                            }
                        } else if (organizationsAvailable.length > 0) {
                            orgId = organizationsAvailable[0].id;
                            orgName = organizationsAvailable[0].name;
                            roleInOrg = organizationsAvailable[0].role;
                            try {
                                const getPl = await getReusableOrganizationSnapshot(orgId);
                                plan = (getPl && getPl.exists && getPl.exists()) ? (getPl.data().music_scale_plan || getPl.data().plan || 'starter') : 'starter';
                            } catch (error) {
                                console.warn("Failed to fetch default organization plan directly:", error);
                            }
                        } else if (userHasLegacy) {
                            await checkAndAddOrg(userHasLegacy, roleInOrg, true);
                        }

                        // A released canonical tenant remains active while discovery only enriches its catalog.
                        if (releasedCanonicalOrgIdRef.current) {
                            orgId = releasedCanonicalOrgIdRef.current;
                        }

                        // Fetch canonical server-resolved access context from the secure endpoint
                        let serverContext = null;
                        if (orgId && orgId !== 'offline_default') {
                            let earlySuccess = false;
                            if (orgId === candidateOrgId && earlyCanonicalPromise) {
                                try {
                                    const resJson = await earlyCanonicalPromise;
                                    if (resJson) {
                                        if (isValidCanonicalResponse(resJson, user.uid, orgId)) {
                                            serverContext = resJson;
                                            systemRole = resJson.systemRole || systemRole;
                                            roleInOrg = resJson.organizationRole || roleInOrg;
                                            earlySuccess = true;
                                            console.log(`[EcosystemContext] Canonical server-resolved access (early):`, resJson);
                                            markStartupMetric('ecosystem_access_context_completed_ms');
                                        } else {
                                            console.warn("[EcosystemContext] Early response was invalid canonical match.");
                                        }
                                    }
                                } catch(e) {
                                    console.warn("Early canonical fetch failed", e);
                                }
                            } else {
                                if (earlyAbortController) {
                                    earlyAbortController.abort();
                                    clearTimeout(earlyTimeoutId);
                                }
                            }
                            
                            if (!earlySuccess) {
                                try {
                                    markStartupMetric('ecosystem_access_context_started_ms');
                                    const token = await user.getIdToken(false);
                                    if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid) {
                                        const controller = new AbortController();
                                        activeControllers.push(controller);
                                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                                        let apiRes;
                                        try {
                                            apiRes = await fetch(`/api/v1/ecosystem/access-context?organizationId=${orgId}`, {
                                                headers: {
                                                    'Authorization': `Bearer ${token}`
                                                },
                                                signal: controller.signal
                                            });
                                        } finally {
                                            clearTimeout(timeoutId);
                                        }
                                        if (apiRes && apiRes.ok) {
                                            const resJson = await apiRes.json();
                                            if (isValidCanonicalResponse(resJson, user.uid, orgId)) {
                                                serverContext = resJson;
                                                systemRole = resJson.systemRole || systemRole;
                                                roleInOrg = resJson.organizationRole || roleInOrg;
                                                console.log(`[EcosystemContext] Canonical server-resolved access:`, resJson);
                                                markStartupMetric('ecosystem_access_context_completed_ms');
                                            } else {
                                                console.warn("[EcosystemContext] Canonical response was invalid match.");
                                            }
                                        } else {
                                            console.warn("[EcosystemContext] Server-resolved access context HTTP error:", apiRes?.status);
                                        }
                                    }
                                } catch (apiErr) {
                                    console.error("[EcosystemContext] Failed to fetch server-resolved access context:", apiErr);
                                }
                            }
                        } else {
                            if (earlyAbortController) {
                                earlyAbortController.abort();
                                clearTimeout(earlyTimeoutId);
                            }
                        }

                        const resolvedSysRole2 = String(systemRole || '').toLowerCase().trim();
                        if (['ceo', 'founder', 'ecosystem_owner', 'owner', 'dono'].includes(resolvedSysRole2)) {
                            systemRole = 'ceo';
                        }
                        
                        const data = {
                           uid: user.uid,
                           email: user.email,
                           displayName,
                           ecosystemRole: systemRole,
                           currentOrganizationId: orgId,
                           currentOrganizationName: orgName,
                           roleInCurrentOrganization: roleInOrg,
                           plan,
                           subscriptionStatus: status,
                           organizationsAvailable,
                           serverContext
                        };

                        if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid && orgId && orgId !== 'offline_default') {
                            try {
                                const cachePayload = getSanitizedContextCache({
                                    uid: user.uid, displayName, ecosystemRole: systemRole,
                                    currentOrganizationId: orgId, currentOrganizationName: orgName,
                                    roleInCurrentOrganization: roleInOrg, plan,
                                    subscriptionStatus: status, organizationsAvailable
                                });
                                localStorage.setItem('musicscale_cached_context_' + user.uid, JSON.stringify(cachePayload));
                            } catch (cacheErr) {
                                console.warn("[MusicScale Ecosystem] Failed to update client context cache:", cacheErr);
                            }
                        }

                        if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid) {
                             const permissions = getCanonicalPermissions(serverContext);
                             if (!serverContext?.effectiveContext) {
                                 if (orgId && orgId !== 'offline_default') {
                                     setIsDegraded(true);
                                 }
                             }
                             setContext((prev: any) => ({
                                 ...payload,
                                 ...data,
                                 ...(releasedCanonicalOrgIdRef.current ? {
                                     currentOrganizationId: releasedCanonicalOrgIdRef.current,
                                     currentOrganizationName: organizationsAvailable.find((organization) => organization.id === releasedCanonicalOrgIdRef.current)?.name || prev?.currentOrganizationName || releasedCanonicalOrgIdRef.current,
                                     roleInCurrentOrganization: prev?.roleInCurrentOrganization,
                                     serverContext: prev?.serverContext,
                                 } : {}),
                                 isStandalone: true,
                                 permissions: releasedCanonicalOrgIdRef.current ? prev?.permissions : permissions
                             }));
                         }
                    } catch (e) {
                        console.warn("[MusicScale Ecosystem] Firestore fetch failed (offline/unavailable), checking local storage cache:", e);
                         const cached = localStorage.getItem('musicscale_cached_context_' + user.uid);
                         if (cached) {
                             try {
                                 const parsed = JSON.parse(cached);
                                 if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid && parsed.uid === user.uid && typeof parsed.currentOrganizationId === 'string' && parsed.currentOrganizationId.trim() !== '') {
                                     setContext((prev: any) => ({
                                         ...payload,
                                         ...parsed,
                                         serverContext: null,
                                         isStandalone: true,
                                         permissions: DENIED_PERMISSIONS
                                     }));
                                     setIsDegraded(true);
                                     console.log("[MusicScale Ecosystem] Restored fully cached offline context.");
                                 }
                             } catch (parseErr) {
                                 console.error("Failed to parse cached local context:", parseErr);
                             }
                         } else {
                             // Default fallback if brand new and offline immediately
                             const offlineDefault = {
                                 uid: user.uid,
                                 email: user.email,
                                 displayName: user.displayName || '',
                                 ecosystemRole: 'none',
                                 currentOrganizationId: 'offline_default',
                                 currentOrganizationName: 'Org Offline',
                                 roleInCurrentOrganization: 'none',
                                 plan: 'starter',
                                 subscriptionStatus: 'inactive',
                                 organizationsAvailable: [{ id: 'offline_default', name: 'Org Offline', role: 'none' }]
                             };

                             if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid) {
                                 setContext((prev: any) => ({
                                     ...payload,
                                     ...offlineDefault,
                                     isStandalone: true,
                                     permissions: DENIED_PERMISSIONS
                                 }));
                                 setIsDegraded(true);
                             }
                         }
                    } finally {
                        if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid) {
                            setIsContextSyncing(false);
                            setIsInitialized(true); // Now we are completely initialized
                            markStartupMetric('ecosystem_context_completed_ms', { standalone: true });
                        }
                    }
                } else {
                    if (mounted) {
                        setContext(payload);
                        setIsContextSyncing(false);
                        setIsInitialized(true); // Now we are completely initialized
                        markStartupMetric('ecosystem_context_completed_ms', { standalone: false });
                    }
                }
                        });
         } else {
            setContext(payload);
            setIsInitialized(true);
            markStartupMetric('ecosystem_context_completed_ms', { standalone: false });
         }
       } catch (error) {
        console.error("Failed to bootstrap Ecosystem Module", error);
        if (mounted) setIsInitialized(true);
      }
    };

    bootstrapModule();

    return () => {
      mounted = false;
      activeGeneration = -1;
      activeControllers.forEach(c => c.abort());
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  const switchOrganization = useCallback(async (orgId: string): Promise<boolean> => {
    const activeContext = contextRef.current;
    const user = auth.currentUser;
    if (!activeContext?.isStandalone || !user || !orgId || activeContext.currentOrganizationId === orgId) {
      return false;
    }

    const requestGeneration = ++switchGeneration.current;
    const expectedUid = user.uid;
    markStartupMetric('organization_switch_started_ms');

    try {
      const token = await user.getIdToken(false);
      if (requestGeneration !== switchGeneration.current || auth.currentUser?.uid !== expectedUid) return false;

      const response = await fetch(`/api/v1/ecosystem/access-context?organizationId=${encodeURIComponent(orgId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Canonical access context failed with status ${response.status}`);

      const canonicalContext = await response.json();
      const effectiveContext = canonicalContext?.effectiveContext;
      const membershipStatus = String(effectiveContext?.membershipStatus || canonicalContext?.membershipStatus || '').toLowerCase();
      const isAuthorized = isValidCanonicalResponse(canonicalContext, expectedUid, orgId)
        && effectiveContext?.resolutionStatus === 'resolved'
        && (effectiveContext?.isGlobalAccess === true || ['active', 'ativo'].includes(membershipStatus));

      if (!isAuthorized) throw new Error('Canonical access context rejected the organization switch');
      if (requestGeneration !== switchGeneration.current || auth.currentUser?.uid !== expectedUid) return false;

      const organization = activeContext.organizationsAvailable.find(candidate => candidate.id === orgId);
      const canonicalRole = canonicalContext.organizationRole || effectiveContext.organizationRole || 'visitor';
      const permissions = getCanonicalPermissions(canonicalContext);
      const nextContext = {
        ...activeContext,
        currentOrganizationId: orgId,
        currentOrganizationName: organization?.name || orgId,
        currentOrganizationSlug: organization?.slug || '',
        roleInCurrentOrganization: canonicalRole,
        // Billing and repair state are hydrated by the target-scoped AuthContext effects.
        // The access-context endpoint does not authoritatively resolve these values.
        plan: 'starter',
        subscriptionStatus: 'inactive',
        entitlements: {},
        capabilities: Array.isArray(effectiveContext.effectiveCapabilities)
          ? [...effectiveContext.effectiveCapabilities]
          : [],
        needsRepair: false,
        repairReasons: [],
        serverContext: canonicalContext,
        permissions,
      };

      // Publish the tenant and its canonical permissions together, then persist preference/cache.
      contextRef.current = nextContext;
      releasedCanonicalOrgIdRef.current = orgId;
      setContext(nextContext);
      setIsDegraded(false);
      try {
        localStorage.setItem('activeOrganizationId', orgId);
      } catch (error) {
        console.warn('[EcosystemContext] Failed to persist active organization preference:', error);
      }
      try {
        localStorage.setItem(
          `musicscale_cached_context_${expectedUid}`,
          JSON.stringify(getSanitizedContextCache(nextContext))
        );
      } catch (error) {
        console.warn('[EcosystemContext] Failed to persist sanitized organization context cache:', error);
      }
      markStartupMetric('organization_switch_completed_ms');
      return true;
    } catch (error) {
      if (requestGeneration === switchGeneration.current && auth.currentUser?.uid === expectedUid) {
        console.warn('[EcosystemContext] Organization switch failed:', error);
        markStartupMetric('organization_switch_failed_ms');
      }
      return false;
    }
  }, []);

  useEffect(() => {
    const handleSyncOrg = (event: Event) => {
       const customEvent = event as CustomEvent<EcosystemContextPayload>;
       
       setContext(prev => {
          if (prev && prev.currentOrganizationId !== customEvent.detail.currentOrganizationId) {
             // Hard reload to prevent React state leaks and clear memory caches
             // The new orgId is already synced in local session or postMessage
             window.location.reload();
             return prev;
          }
          return customEvent.detail;
       });
       
       setIsDegraded(false);
    };
    
    const handleInvalidate = () => {
       // Perform full logout or session termination
       auth.signOut();
    };

    const handleDegraded = () => {
        setIsDegraded(true);
    };

    window.addEventListener('ecosystem:sync_org', handleSyncOrg);
    window.addEventListener('ecosystem:invalidate_session', handleInvalidate);
    window.addEventListener('ecosystem:degraded_mode', handleDegraded);

    return () => {
       window.removeEventListener('ecosystem:sync_org', handleSyncOrg);
       window.removeEventListener('ecosystem:invalidate_session', handleInvalidate);
       window.removeEventListener('ecosystem:degraded_mode', handleDegraded);
    };
  }, []);

  const publishEvent = (event: EcosystemEvent) => {
    ecosystemBridge.publishEvent(event);
  };

  const navigateToEcosystem = (path?: string) => {
    ecosystemBridge.navigateToEcosystem(path);
  };

  const value = useMemo(() => ({
      isInitialized, 
      isContextSyncing,
      context, 
      publishEvent, 
      navigateToEcosystem,
      isStandalone: !!context?.isStandalone,
      isDegraded,
      switchOrganization
  }), [isInitialized, isContextSyncing, context, isDegraded, switchOrganization]);

  if (!isInitialized || !context || isContextSyncing) {
    return (
      <div className="flex bg-background h-screen justify-center items-center flex-col gap-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-500 uppercase tracking-widest animate-pulse">
          Sincronizando Ecossistema...
        </p>
      </div>
    );
  }

  return (
    <EcosystemContext.Provider value={value}>
      {children}
    </EcosystemContext.Provider>
  );
};
