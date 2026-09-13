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
        if (openModalCount === 0) document.body.style.overflow = "hidden";
        openModalCount++;
      }

      return () => {
        if (isLocalOpen) {
          openModalCount--;
          if (openModalCount === 0) document.body.style.overflow = "";
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
        <div
          className="absolute inset-0 bg-black/[0.76] transition-opacity duration-200"
          onClick={onClose}
        />

        <div
          ref={ref}
          className={`relative z-10 flex h-[100dvh] w-full ${maxWidth} touch-auto flex-col overflow-hidden border-0 bg-[linear-gradient(180deg,#17171e_0%,#0b0b10_100%)] shadow-[0_36px_110px_-30px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.05)] animate-slide-up-sheet md:h-auto md:max-h-[90vh] md:animate-scale-in md:rounded-[26px] md:border md:border-white/[0.09]`}
        >
          <div className="flex shrink-0 justify-center pb-2 pt-3.5 md:hidden" onClick={onClose}>
            <div className="h-1 w-10 rounded-full bg-white/[0.14]" />
          </div>

          {title && (
            <div className="shrink-0 border-b border-white/[0.07] px-5 pb-4 pt-1 md:px-7 md:py-5">
              {title}
            </div>
          )}

          <div className="custom-scrollbar relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-5 sm:py-5 md:px-7 md:py-6">
            {children}
          </div>

          {footer && (
            <div className="shrink-0 border-t border-white/[0.07] bg-white/[0.018] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-7 md:py-5">
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