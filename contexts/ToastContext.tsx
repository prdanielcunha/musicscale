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
import { useTranslation } from "react-i18next";
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
  onClick?: () => void;
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
  const { t } = useTranslation();

  const addToast = useCallback((toastOptions: Omit<Toast, "id" | "message" | "type"> & { id?: string; message?: string; title?: string; type?: ToastType; variant?: string }) => {
    const id = toastOptions.id || Math.random().toString(36).substring(2, 9);

    // Normalize options for shadcn/ui compatibility
    const message = toastOptions.message || toastOptions.title || "";
    const type = toastOptions.type || (toastOptions.variant === "destructive" ? "error" : "success");

    const toast: Toast = { ...toastOptions, id, message, type };

    setToasts((prev) => {
      // If a toast with this ID already exists, replace it. Keep the transient
      // presentation layer bounded so notification bursts never cover the app.
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, toast].slice(-4);
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
        duration: 10000,
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
            .filter((toastItem) => toastItem.type === "success")
            .map((toastItem) => (
              <motion.div
                key={toastItem.id}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto bg-white/95 dark:bg-[#1C1C1E]/95 sm:bg-white/80 sm:dark:bg-[#1C1C1E]/80 sm:backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] px-4 py-2.5 rounded-full flex items-center gap-2.5 max-w-[90vw]"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-[14px] font-medium tracking-tight text-slate-800 dark:text-white/90 truncate">
                  {toastItem.message}
                </span>
                {toastItem.description && (
                  <span className="text-[13px] opacity-70 truncate font-normal ml-1">
                    {toastItem.description}
                  </span>
                )}
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      <div data-testid="toast-alert-viewport" className="fixed top-[max(1rem,env(safe-area-inset-top))] right-0 sm:top-[max(2rem,env(safe-area-inset-top))] sm:right-8 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-[400px] px-4 sm:px-0">
        <AnimatePresence>
          {toasts
            .filter((toastItem) => toastItem.type !== "success")
            .map((toastItem) => (
              <motion.div
                key={toastItem.id}
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  y: -8,
                  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto overflow-hidden relative flex items-start gap-4 p-4 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] ${toastItem.onClick ? "cursor-pointer" : ""} ${
                  toastItem.type === "error"
                    ? "bg-red-50/95 dark:bg-[#241315]/95 border border-red-500/20 text-red-900 dark:text-red-100"
                    : toastItem.type === "feedback"
                      ? "bg-indigo-50/95 dark:bg-[#151522]/95 border border-indigo-200/50 dark:border-indigo-500/20 text-indigo-950 dark:text-indigo-50"
                      : "bg-slate-50/95 dark:bg-[#151517]/95 border border-slate-200/50 dark:border-white/10 text-slate-900 dark:text-white"
                }`}
              >
                <div className="absolute inset-0 hidden sm:block bg-white/60 dark:bg-[#111111]/80 backdrop-blur-2xl -z-10"></div>

                <div
                  className={`mt-0.5 shrink-0 ${
                    toastItem.type === "error"
                      ? "text-red-500"
                      : toastItem.type === "feedback"
                        ? "text-indigo-500"
                        : "text-slate-500"
                  }`}
                >
                  {toastItem.type === "error" && <AlertCircle className="w-5 h-5" />}
                  {toastItem.type === "feedback" && <span className="text-lg">👋</span>}
                  {toastItem.type === "info" && <Info className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[14px] leading-tight">
                    {toastItem.message}
                  </h4>
                  {toastItem.description && (
                    <p className="text-[13px] opacity-80 mt-1 font-medium">
                      {toastItem.description}
                    </p>
                  )}

                  {toastItem.type === "feedback" &&
                    toastItem.positiveAction &&
                    toastItem.negativeAction && (
                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={() => {
                            toastItem.positiveAction!.onClick();
                            removeToast(toastItem.id);
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold transition-all active:scale-95 text-center shadow-sm touch-manipulation"
                        >
                          {toastItem.positiveAction.label}
                        </button>
                        <button
                          onClick={() => {
                            toastItem.negativeAction!.onClick();
                            removeToast(toastItem.id);
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-indigo-900 dark:text-indigo-200 border border-indigo-100 dark:border-white/10 text-[12px] font-bold transition-all active:scale-95 text-center touch-manipulation"
                        >
                          {toastItem.negativeAction.label}
                        </button>
                      </div>
                    )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toastItem.id)}
                  className="shrink-0 -mr-1 -mt-1 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 transition-colors touch-manipulation"
                  aria-label={t('common.close', 'Fechar')}
                >
                  <X className="w-4 h-4 opacity-60" />
                </button>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
      </>, document.body)}
    </ToastContext.Provider>
  );
};
