import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useEcosystem } from "../../contexts/EcosystemContext";
import { CanonicalAccessUnavailableScreen } from "./CanonicalAccessUnavailableScreen";
import Spinner from "../common/Spinner";

interface GlobalCurationProtectedRouteProps {
  children: React.ReactElement;
}

const GlobalCurationProtectedRoute: React.FC<GlobalCurationProtectedRouteProps> = ({
  children,
}) => {
  const { loading, isCurationAdmin } = useAuth();
  const { accessContextStatus } = useEcosystem();

  if (accessContextStatus === 'infrastructure_unavailable') {
    return <CanonicalAccessUnavailableScreen />;
  }

  if (loading || isCurationAdmin === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isCurationAdmin) {
    // Prevent infinite redirect loop if already on the root path
    if (window.location.pathname === "/") {
       return (
         <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8 space-y-4">
           <h2 className="text-xl font-bold">Sem Permissão</h2>
           <p className="text-slate-400">Você não tem acesso global autorizado para visualizar esta área.</p>
         </div>
       );
    }
    // Redirect them to the home page if they don't have permission
    return <Navigate to="/" replace />;
  }

  return children;
};

export default GlobalCurationProtectedRoute;
