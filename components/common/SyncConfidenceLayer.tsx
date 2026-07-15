import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useOffline } from "../../contexts/OfflineContext";
import { useEcosystem } from "../../contexts/EcosystemContext";

export const SyncConfidenceLayer: React.FC = () => {
  const { isOffline, syncPending, isSlowConnection } = useOffline();
  const { isDegraded } = useEcosystem();
  const [showStatus, setShowStatus] = useState(false);
  const [statusType, setStatusType] = useState<
    "offline" | "slow" | "syncing" | "saved" | "restored" | "degraded"
  >("saved");

  useEffect(() => {
    const handleRestored = () => {
      setStatusType("restored");
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };
    const handleLocalSave = () => {
      // If we are currently showing offline, slow, or syncing, don't override with local save immediately
      if (
        statusType !== "offline" &&
        statusType !== "syncing" &&
        statusType !== "slow" &&
        statusType !== "degraded"
      ) {
        setStatusType("saved");
        setShowStatus(true);
        setTimeout(() => setShowStatus(false), 2000);
      }
    };
    window.addEventListener("musicscale:restored", handleRestored);
    window.addEventListener("musicscale:local_save", handleLocalSave);
    return () => {
      window.removeEventListener("musicscale:restored", handleRestored);
      window.removeEventListener("musicscale:local_save", handleLocalSave);
    };
  }, [statusType]);

  useEffect(() => {
    if (isDegraded) {
      setStatusType("degraded");
      setShowStatus(true);
    } else if (isOffline) {
      setStatusType("offline");
      setShowStatus(true);
    } else if (isSlowConnection) {
      setStatusType("slow");
      setShowStatus(true);
    } else if (syncPending) {
      setStatusType("syncing");
      setShowStatus(true);
    } else {
      if (
        statusType === "syncing" ||
        statusType === "offline" ||
        statusType === "slow" ||
        statusType === "saved" || 
        statusType === "degraded"
      ) {
        setStatusType("saved");
        setShowStatus(true);
        const timer = setTimeout(() => {
          setShowStatus(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOffline, syncPending, isSlowConnection, isDegraded]);

  return (
    <AnimatePresence>
      {showStatus && (
        <motion.div
          initial={{ opacity: 0, y: -20, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
        >
          <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] px-4 py-1.5 rounded-full flex items-center justify-center min-w-[120px]">
            {statusType === "degraded" && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></div>
                <span className="text-[12px] font-medium tracking-wide text-amber-600 dark:text-amber-400">
                  Modo Degrado (Segurança)
                </span>
              </div>
            )}
            {statusType === "offline" && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-[12px] font-medium tracking-wide text-slate-600 dark:text-slate-300">
                  Offline (Protegido)
                </span>
              </div>
            )}
            {statusType === "slow" && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-[12px] font-medium tracking-wide text-slate-600 dark:text-slate-300">
                  Conexão Lenta
                </span>
              </div>
            )}
            {statusType === "syncing" && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-3 h-3 text-indigo-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-[12px] font-medium tracking-wide text-slate-600 dark:text-slate-300">
                  Sincronizando...
                </span>
              </div>
            )}
            {statusType === "saved" && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-[12px] font-medium tracking-wide text-slate-600 dark:text-slate-300">
                  Salvo
                </span>
              </div>
            )}
            {statusType === "restored" && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
                <span className="text-[12px] font-medium tracking-wide text-slate-600 dark:text-slate-300">
                  Sessão Restaurada
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
