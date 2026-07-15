import React from "react";
import Modal from "./Modal";
import Button from "./Button";

const CheckCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionText: string;
  onAction: () => void;
  stayText: string;
  onStay: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  actionText,
  onAction,
  stayText,
  onStay,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="max-w-md"
      noPadding={true}
      zIndexClass="z-[120]"
    >
      <div className="relative overflow-hidden p-6 sm:p-8 flex flex-col items-center bg-surface dark:bg-[#0c0c0e]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center w-full relative z-10">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mb-5 shadow-[0_8px_24px_rgba(16,185,129,0.12)]">
            <CheckCircleIcon className="h-6 w-6 stroke-[2]" />
          </div>

          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug mb-2">
            {title}
          </h3>

          <p className="text-[14px] sm:text-[15px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-xs px-2 mb-8">
            {message}
          </p>

          <div className="flex flex-col sm:flex-row-reverse sm:items-center gap-3 w-full">
            <button
              onClick={onAction}
              className="relative h-12 w-full sm:flex-1 bg-gradient-to-tr from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-[14px] tracking-wide rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-[0_8px_20px_rgba(16,185,129,0.25)] flex items-center justify-center cursor-pointer"
            >
              {actionText}
            </button>

            <button
              onClick={onStay}
              className="h-12 w-full sm:flex-1 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-[14px] tracking-wide rounded-2xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center cursor-pointer"
            >
              {stayText}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SuccessModal;
