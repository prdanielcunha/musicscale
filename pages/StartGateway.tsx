import { logger } from "../lib/logger";
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Spinner from "../components/common/Spinner";
import { useEcosystem } from "../contexts/EcosystemContext";
import { ecosystemBridge } from "../services/ecosystem/EcosystemBridge";
import TenantOnboarding from "./TenantOnboarding";
import { MissingSubscriptionScreen } from "../components/premium/MissingSubscriptionScreen";

export default function StartGateway() {
  const {
    user,
    userProfile,
    loading,
    organization,
    subscription,
    isSubscriptionLoaded,
    isAdmin,
    isOwner,
    isGlobalAdmin,
    needsRepair
  } = useAuth();
  const { context: ecoContext } = useEcosystem();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasActiveSub = subscription?.status === "active" || subscription?.status === "trialing" || subscription?.status === "trial" || subscription?.status === "pro";
  
  const bypassSubscription = isGlobalAdmin;

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
    subscriptionStatus: ecoContext?.subscriptionStatus,
    plan: ecoContext?.plan,
    bypassSubscription,
    isGlobalAdmin
  });

  if (loading || isRefreshing || (user && userProfile && !isSubscriptionLoaded)) {
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

  // 4. Se TEM organização, verificamos a assinatura centralizada
  if (!hasActiveSub && !bypassSubscription) {
    logger.debug("[GATEKEEPER_STATUS] Acesso negado no StartGateway.", {
      statusCentralizado: subscription?.status,
      organizationId: organization?.id
    });
    return <MissingSubscriptionScreen />;
  }

  // 5. Usuário com acesso liberado (trialing/active/bypass)
  logger.debug("[StartGateway] Redirecting to workspace.");
  return <Navigate to="/" replace />;
}

