import React, { useEffect, createContext, useContext, useState } from "react";

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
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  // P3.2 keeps the public context shape stable while the unsafe legacy custom
  // Firestore replay queue is quarantined. Native Firestore persistence remains
  // responsible for its own offline synchronization.
  const syncPending = false;

  useEffect(() => {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    const checkConnectionQuality = () => {
      if (!connection) {
        setIsSlowConnection(false);
        return;
      }

      setIsSlowConnection(
        connection.effectiveType === "2g" ||
        connection.effectiveType === "slow-2g",
      );
    };

    const handleOnline = () => {
      setIsOffline(false);
      checkConnectionQuality();
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsSlowConnection(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (connection) {
      connection.addEventListener("change", checkConnectionQuality);
      checkConnectionQuality();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (connection) {
        connection.removeEventListener("change", checkConnectionQuality);
      }
    };
  }, []);

  const value = React.useMemo(
    () => ({ isOffline, syncPending, isSlowConnection }),
    [isOffline, isSlowConnection],
  );

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};
