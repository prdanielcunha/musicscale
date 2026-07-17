import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, AppPermissions } from "../../contexts/AuthContext";
import { useEcosystem } from "../../contexts/EcosystemContext";
import { CanonicalAccessUnavailableScreen } from "./CanonicalAccessUnavailableScreen";
import Spinner from "../common/Spinner";
import { getSubscriptionBlockReason } from "../../utils/subscriptionValidator";

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredPermission: keyof AppPermissions;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
}) => {
  const { permissions, loading, isGlobalAdmin, entitlements, organization, subscription } = useAuth();
  const { accessContextStatus } = useEcosystem();

  const isSubscriptionValid = React.useMemo(() => {
    if (isGlobalAdmin) return true;
    const { valid } = getSubscriptionBlockReason({ entitlements, organization, subscription });
    return valid;
  }, [entitlements, organization, subscription, isGlobalAdmin]);

  if (accessContextStatus === 'infrastructure_unavailable') {
    return <CanonicalAccessUnavailableScreen />;
  }

  if (loading || permissions === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  // Handle subscription blockage for non-allowed routes
  const isAllowedRouteDuringSuspension = 
    window.location.pathname === '/plans' || 
    window.location.pathname === '/profile' || 
    window.location.pathname.startsWith('/debug');

  if (!isSubscriptionValid && !isAllowedRouteDuringSuspension) {
    return <Navigate to="/" replace />;
  }

  const hasPermission = permissions[requiredPermission];

  if (!hasPermission) {
    // Prevent infinite redirect loop if already on the root path
    if (window.location.pathname === "/") {
       return (
         <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8 space-y-4">
           <h2 className="text-xl font-bold">Sem Permissão</h2>
           <p className="text-slate-400">Você não tem os acessos necessários para visualizar esta página.</p>
         </div>
       );
    }
    // Redirect them to the home page if they don't have permission
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
