import React, { useEffect, forwardRef, ForwardedRef } from "react";
import { createPortal } from "react-dom";

interface PremiumSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "max-w-2xl" | "max-w-3xl" | "max-w-4xl" | "max-w-5xl" | "max-w-6xl";
  zIndexClass?: string;
  dataTestId?: string;
}

let openModalCount = 0;

const PremiumSheetModal = forwardRef<HTMLDivElement, PremiumSheetModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      children,
      footer,
      maxWidth = "max-w-5xl",
      zIndexClass = "z-[100]",
      dataTestId
    },
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    useEffect(() => {
      let isLocalOpen = isOpen;

      if (isOpen) {
        if (openModalCount === 0) {
          document.body.style.overflow = "hidden";
        }
        openModalCount++;
      }

      return () => {
        if (isLocalOpen) {
          openModalCount--;
          if (openModalCount === 0) {
            document.body.style.overflow = "";
          }
        }
      };
    }, [isOpen]);

    if (!isOpen) return null;

    const modalContent = (
      <div
        className={`fixed inset-0 ${zIndexClass} flex flex-col md:items-center md:justify-center md:p-6`}
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
        data-testid={dataTestId}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        ></div>

        {/* Modal Container */}
        <div
          ref={ref}
          className={`relative z-10 w-full ${maxWidth} bg-white dark:bg-[#05070D]/95 dark:backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.2)] md:dark:shadow-[0_0_40px_rgba(59,130,246,0.03)] transition-all duration-300 flex flex-col overflow-hidden animate-slide-up-sheet md:animate-scale-in touch-auto
            h-[100dvh] md:h-auto md:max-h-[90vh] rounded-none md:rounded-[28px] border-0 md:border md:border-slate-200 dark:md:border-white/10
          `}
        >
          {/* Mobile Handle */}
          <div className="md:hidden flex justify-center pt-4 pb-2 bg-transparent shrink-0" onClick={onClose}>
            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-white/10"></div>
          </div>

          {/* Header */}
          {title && (
            <div className="px-5 pt-1 pb-4 md:px-8 md:py-6 shrink-0 border-b border-slate-100 dark:border-white/5">
              {title}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6 relative flex flex-col">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-5 shrink-0 border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-[#05070D]/80 backdrop-blur-xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  }
);

PremiumSheetModal.displayName = "PremiumSheetModal";

export default PremiumSheetModal;
