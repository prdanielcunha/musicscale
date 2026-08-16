import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { emotionTracker } from "../services/emotionTelemetry";

export type ToastType = "success" | "error" | "info" | "feedback";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  variant?: string;
  description?: string;
  duration?: number;
  onClick?: () => void; // Add this
  positiveAction?: { label: string; onClick: () => void };
  negativeAction?: { label: string; onClick: () => void };
}

interface ToastContextType {
  toast: (options: Omit<Toast, "id" | "message" | "type"> & { id?: string; message?: string; title?: string; type?: ToastType; variant?: string }) => void;
  removeToast: (id: string) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  feedbackToast: (
    message: string,
    onPositive: () => void,
    onNegative: () => void,
    positiveLabel?: string,
    negativeLabel?: string,
  ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toastOptions: Omit<Toast, "id" | "message" | "type"> & { id?: string; message?: string; title?: string; type?: ToastType; variant?: string }) => {
    const id = toastOptions.id || Math.random().toString(36).substring(2, 9);
    
    // Normalize options for shadcn/ui compatibility
    const message = toastOptions.message || toastOptions.title || "";
    const type = toastOptions.type || (toastOptions.variant === "destructive" ? "error" : "success");
    
    const toast: Toast = { ...toastOptions, id, message, type };

    setToasts((prev) => {
      // If a toast with this ID already exists, replace it
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, toast];
    });

    if (toast.type === "success" && toast.message) {
      emotionTracker.track(
        "delight",
        `toast_success_${toast.message.substring(0, 20)}`,
      );
    }

    if (toast.duration !== 0) {
      setTimeout(
        () => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        },
        toast.duration || (toast.type === "success" ? 3000 : toast.type === "error" ? 8000 : 4000),
      );
    }
  }, []);

  const success = useCallback(
    (message: string, description?: string) =>
      addToast({ type: "success", message, description }),
    [addToast],
  );
  const error = useCallback(
    (message: string, description?: string) =>
      addToast({ type: "error", message, description }),
    [addToast],
  );

  const feedbackToast = useCallback(
    (
      message: string,
      onPositive: () => void,
      onNegative: () => void,
      positiveLabel = "Excelente",
      negativeLabel = "Pode melhorar",
    ) => {
      addToast({
        type: "feedback",
        message,
        duration: 10000, // Stays longer
        positiveAction: {
          label: positiveLabel,
          onClick: onPositive,
        },
        negativeAction: {
          label: negativeLabel,
          onClick: onNegative,
        },
      });
    },
    [addToast],
  );

  const removeToast = useCallback((id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const value = useMemo(() => ({
    toast: addToast,
    removeToast,
    success,
    error,
    feedbackToast
  }), [addToast, removeToast, success, error, feedbackToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" && createPortal(<>
      <div data-testid="toast-success-viewport" className="fixed bottom-[max(2.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[9999] pointer-events-none w-max">
        <AnimatePresence>
          {toasts
            .filter((t) => t.type === "success")
            .map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] px-4 py-2.5 rounded-full flex items-center gap-2.5 max-w-[90vw]"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-[14px] font-medium tracking-tight text-slate-800 dark:text-white/90 truncate">
                  {t.message}
                </span>
                {t.description && (
                  <span className="text-[13px] opacity-70 truncate font-normal ml-1">
                    {t.description}
                  </span>
                )}
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      <div data-testid="toast-alert-viewport" className="fixed top-[max(1rem,env(safe-area-inset-top))] right-0 sm:top-[max(2rem,env(safe-area-inset-top))] sm:right-8 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-[400px] px-4 sm:px-0">
        <AnimatePresence>
          {toasts
            .filter((t) => t.type !== "success")
            .map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -20, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  filter: "blur(4px)",
                  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto overflow-hidden relative flex items-start gap-4 p-4 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] ${t.onClick ? "cursor-pointer" : ""} ${
                  t.type === "error"
                    ? "bg-red-500/10 border border-red-500/20 text-red-900 dark:text-red-100"
                    : t.type === "feedback"
                      ? "bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 text-indigo-950 dark:text-indigo-50"
                      : "bg-slate-50/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 text-slate-900 dark:text-white"
                }`}
              >
                <div className="absolute inset-0 bg-white/60 dark:bg-[#111111]/80 backdrop-blur-2xl -z-10"></div>

                <div
                  className={`mt-0.5 shrink-0 ${
                    t.type === "error"
                      ? "text-red-500"
                      : t.type === "feedback"
                        ? "text-indigo-500"
                        : "text-slate-500"
                  }`}
                >
                  {t.type === "error" && <AlertCircle className="w-5 h-5" />}
                  {t.type === "feedback" && <span className="text-lg">👋</span>}
                  {t.type === "info" && <Info className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[14px] leading-tight">
                    {t.message}
                  </h4>
                  {t.description && (
                    <p className="text-[13px] opacity-80 mt-1 font-medium">
                      {t.description}
                    </p>
                  )}

                  {t.type === "feedback" &&
                    t.positiveAction &&
                    t.negativeAction && (
                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={() => {
                            t.positiveAction!.onClick();
                            removeToast(t.id);
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold transition-all active:scale-95 text-center shadow-sm"
                        >
                          {t.positiveAction.label}
                        </button>
                        <button
                          onClick={() => {
                            t.negativeAction!.onClick();
                            removeToast(t.id);
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-indigo-900 dark:text-indigo-200 border border-indigo-100 dark:border-white/10 text-[12px] font-bold transition-all active:scale-95 text-center"
                        >
                          {t.negativeAction.label}
                        </button>
                      </div>
                    )}
                </div>
                {t.type !== "feedback" && (
                  <button
                    onClick={() => removeToast(t.id)}
                    className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4 opacity-50 hover:opacity-100" />
                  </button>
                )}
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
      </>, document.body)}
    </ToastContext.Provider>
  );
};
