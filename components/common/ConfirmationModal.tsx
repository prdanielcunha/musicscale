import React from "react";
import Modal from "./Modal";
import { AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  zIndexClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isLoading = false,
  zIndexClass,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="" // Passes empty to use a fully unified, elegant Apple-style center-aligned layout
      maxWidth="max-w-md"
      noPadding={true}
      zIndexClass={zIndexClass}
    >
      <div className="relative overflow-hidden p-6 sm:p-8 flex flex-col items-center bg-surface dark:bg-[#0c0c0e]">
        {/* Subtle decorative glowing background accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center w-full relative z-10"
        >
          {/* Circular Apple-styled warning banner of danger */}
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 mb-5 shadow-[0_8px_24px_rgba(244,63,94,0.12)]">
            <AlertTriangle className="w-6 h-6 stroke-[2]" />
          </div>

          {/* Premium editorial bold typography */}
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug mb-2">
            {title}
          </h3>

          <p className="text-[14px] sm:text-[15px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-xs px-2 mb-8">
            {message}
          </p>

          {/* Apple Action Buttons layout - Vertical stack for supreme mobile ergonomic reachability, horizontal for desktop */}
          <div className="flex flex-col sm:flex-row-reverse sm:items-center gap-3 w-full">
            {/* Primary Destructive Button - Absolute contrast & vibrant red */}
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="relative h-12 w-full sm:flex-1 bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold text-[14px] tracking-wide rounded-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-[0_8px_20px_rgba(239,68,68,0.25)] flex items-center justify-center cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Aguarde...</span>
                </div>
              ) : (
                confirmText
              )}
            </button>

            {/* Cancel Button - Silent contrast outline */}
            <button
              onClick={onClose}
              disabled={isLoading}
              className="h-12 w-full sm:flex-1 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-[14px] tracking-wide rounded-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
            >
              {cancelText}
            </button>
          </div>
        </motion.div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
