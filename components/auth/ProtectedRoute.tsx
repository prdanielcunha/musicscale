import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, AppPermissions } from "../../contexts/AuthContext";
import { useCapability } from "../../hooks/useCapability";
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
  const { hasCapability } = useCapability();

  const isSubscriptionValid = React.useMemo(() => {
    if (isGlobalAdmin) return true;
    const { valid } = getSubscriptionBlockReason({ entitlements, organization, subscription });
    return valid;
  }, [entitlements, organization, subscription, isGlobalAdmin]);

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

  // /database manages MusicScale taxonomy, not organization-wide settings.
  // Leaders already receive the canonical taxonomy.*.manage capabilities from
  // the RBAC resolver and Firestore Rules. Keep plans/backup/debug guarded by
  // manageOrganization while allowing this domain-specific route independently.
  const effectivePermission =
    window.location.pathname.startsWith('/database') && requiredPermission === 'manageOrganization'
      ? 'musicscale.taxonomy.manage'
      : requiredPermission;
  const hasPermission = hasCapability(effectivePermission) || isGlobalAdmin;

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
