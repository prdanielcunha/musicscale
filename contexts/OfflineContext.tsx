import React, { useEffect, createContext, useContext, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  processSyncQueue,
  triggerBackgroundSync,
} from "../services/offline/syncManager";
import { useToast } from "./ToastContext";

export interface OfflineContextType {
  isOffline: boolean;
  syncPending: boolean;
  isSlowConnection: boolean;
}

const OfflineContext = createContext<OfflineContextType>({
  isOffline: false,
  syncPending: false,
  isSlowConnection: false,
});

export const useOffline = () => useContext(OfflineContext);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncPending, setSyncPending] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const { organization } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (organization?.id) triggerBackgroundSync(organization.id);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsSlowConnection(false);
    };

    const checkConnectionQuality = () => {
      const connection =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;
      if (connection) {
        if (
          connection.effectiveType === "2g" ||
          connection.effectiveType === "slow-2g"
        ) {
          setIsSlowConnection(true);
        } else {
          setIsSlowConnection(false);
        }
      }
    };

    const handleSync = async () => {
      if (!organization?.id || isOffline) return;
      setSyncPending(true);
      await processSyncQueue(organization.id);
      setSyncPending(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("musicscale:sync", handleSync);

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener("change", checkConnectionQuality);
      checkConnectionQuality();
    }

    // Initial sync check
    if (navigator.onLine && organization?.id) {
      handleSync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("musicscale:sync", handleSync);
      if (connection) {
        connection.removeEventListener("change", checkConnectionQuality);
      }
    };
  }, [organization?.id, isOffline]);

  const value = React.useMemo(() => ({ isOffline, syncPending, isSlowConnection }), [isOffline, syncPending, isSlowConnection]);

  return (
    <OfflineContext.Provider
      value={value}
    >
      {children}
    </OfflineContext.Provider>
  );
};
