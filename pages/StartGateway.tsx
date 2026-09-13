import { logger } from "../lib/logger";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Spinner from "../components/common/Spinner";
import { useEcosystem } from "../contexts/EcosystemContext";
import { redirectToHubLaunch } from "../services/ecosystem/handoffHelper";
const TenantOnboarding = lazy(() => import("./TenantOnboarding"));
import { MissingSubscriptionScreen } from "../components/premium/MissingSubscriptionScreen";
import { resolveSubscriptionAccess } from "../utils/subscriptionAccessResolver";

const START_GATEWAY_READY_EVENT = 'musicscale:startup-interactive-ready';

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

  const isPrimaryLoading = Boolean(
    loading || isRefreshing || (user && userProfile && !resolution.loaded)
  );
  const isWaitingForOrganizationHydration = Boolean(
    !organization && ecoContext?.currentOrganizationId
  );
  const isStartupInteractiveReady = !isPrimaryLoading && !isWaitingForOrganizationHydration;

  useEffect(() => {
    if (!isStartupInteractiveReady) return;
    window.dispatchEvent(new CustomEvent(START_GATEWAY_READY_EVENT));
  }, [isStartupInteractiveReady]);

  useEffect(() => {
    if (loading || user) return;
    // Direct official-domain entry should reuse the Hub identity instead of
    // presenting a second MusicScale login screen.
    redirectToHubLaunch('/start');
  }, [loading, user]);

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

  if (isPrimaryLoading || (!loading && !user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Spinner />
        <p className="mt-4 text-slate-500 font-medium">{!user ? 'Conectando ao MillionsNest...' : 'Sincronizando assinatura...'}</p>
      </div>
    );
  }

  if (!user || (!userProfile && !loading)) {
    return <Navigate to="/login" replace />;
  }

  if (needsRepair) {
    return <Navigate to="/" replace />;
  }

  if (isWaitingForOrganizationHydration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0b] dark:bg-[#050505] text-white">
        <Spinner size="lg" />
        <p className="mt-6 text-sm text-slate-500 font-medium tracking-widest uppercase">Sincronizando Ambiente...</p>
      </div>
    );
  }

  if (!organization && !ecoContext?.currentOrganizationId) {
    logger.debug("[StartGateway] No organization context found. Showing internal exact screen.");
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><Spinner /></div>}>
        <TenantOnboarding />
      </Suspense>
    );
  }

  if (!resolution.valid) {
    logger.debug("[GATEKEEPER_STATUS] Acesso negado no StartGateway.", {
      statusCentralizado: resolution.status,
      reason: resolution.reason,
      organizationId: organization?.id
    });
    return <MissingSubscriptionScreen resolution={resolution} />;
  }

  if (organization?.onboardingState === 'pending_profile') {
    logger.debug("[StartGateway] Bootstrap workspace needs organization profile completion.");
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900"><Spinner /></div>}>
        <TenantOnboarding />
      </Suspense>
    );
  }

  logger.debug("[StartGateway] Redirecting to workspace.");
  return <Navigate to="/" replace />;
}
