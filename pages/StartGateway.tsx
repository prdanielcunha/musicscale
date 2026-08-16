import { logger } from "../lib/logger";
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Spinner from "../components/common/Spinner";
import { useEcosystem } from "../contexts/EcosystemContext";
import TenantOnboarding from "./TenantOnboarding";
import { MissingSubscriptionScreen } from "../components/premium/MissingSubscriptionScreen";
import { resolveSubscriptionAccess } from "../utils/subscriptionAccessResolver";

export default function StartGateway() {
  const {
    user,
    userProfile,
    loading,
    organization,
    subscription,
    isSubscriptionLoaded,
    entitlements,
    isEntitlementsLoaded,
    isGlobalAdmin,
    needsRepair
  } = useAuth();
  const { context: ecoContext } = useEcosystem();

  const [isRefreshing] = useState(false);

  const resolution = resolveSubscriptionAccess(
    loading,
    isSubscriptionLoaded,
    isEntitlementsLoaded,
    { entitlements, organization, subscription },
    isGlobalAdmin
  );

  console.log("[MusicScale Gate Debug]", {
    firebaseUserUid: user?.uid,
    firebaseUserEmail: user?.email,
    authLoading: loading,
    effectiveOrganizationId: organization?.id,
    canonicalCurrentOrganizationId: ecoContext?.currentOrganizationId,
    canonicalCurrentOrganizationName: ecoContext?.currentOrganizationName,
    ecosystemRole: ecoContext?.ecosystemRole,
    systemRole: ecoContext?.systemRole,
    roleInCurrentOrganization: ecoContext?.roleInCurrentOrganization,
    subscriptionStatus: subscription?.status,
    entitlementStatus: entitlements?.status,
    plan: ecoContext?.plan,
    accessStatus: resolution.status,
    accessReason: resolution.reason,
    isGlobalAdmin
  });

  if (loading || isRefreshing || (user && userProfile && !resolution.loaded)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Spinner />
        {isRefreshing && <p className="mt-4 text-slate-500 font-medium">Sincronizando assinatura...</p>}
      </div>
    );
  }

  // 1. Usuário NÃO autenticado
  if (!user || (!userProfile && !loading)) {
    return <Navigate to="/login" replace />;
  }

  // 2. Contexto precisa de reparo?
  if (needsRepair) {
    return <Navigate to="/" replace />; // Gatekeeper has RepairNeededScreen
  }

  // Wait for local organization cache to hydrate if we have an ecosystem org
  if (!organization && ecoContext?.currentOrganizationId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0b] dark:bg-[#050505] text-white">
        <Spinner size="lg" />
        <p className="mt-6 text-sm text-slate-500 font-medium tracking-widest uppercase">Sincronizando Ambiente...</p>
      </div>
    );
  }

  // 3. Organization existente?
  if (!organization && !ecoContext?.currentOrganizationId) {
    logger.debug("[StartGateway] No organization context found. Showing internal exact screen.");
    return <TenantOnboarding />;
  }

  // 4. Use the same centralized subscription/entitlement resolver as AppLayout.
  // The Hub-backed entitlements path is authoritative; the legacy local subscription
  // document may be unavailable to the browser under hardened Firestore Rules.
  if (!resolution.valid) {
    logger.debug("[GATEKEEPER_STATUS] Acesso negado no StartGateway.", {
      statusCentralizado: resolution.status,
      reason: resolution.reason,
      organizationId: organization?.id
    });
    return <MissingSubscriptionScreen resolution={resolution} />;
  }

  // 5. Usuário com acesso liberado
  logger.debug("[StartGateway] Redirecting to workspace.");
  return <Navigate to="/" replace />;
}
