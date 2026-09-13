import React, { useEffect, forwardRef, ForwardedRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?:
    | "max-w-sm"
    | "max-w-md"
    | "max-w-lg"
    | "max-w-2xl"
    | "max-w-3xl"
    | "max-w-4xl"
    | "max-w-5xl"
    | "max-w-6xl"
    | "max-w-7xl";
  noPadding?: boolean;
  zIndexClass?: string;
  fullHeight?: boolean;
}

let openModalCount = 0;

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      children,
      footer,
      maxWidth = "max-w-2xl",
      noPadding = false,
      zIndexClass = "z-[110]",
      fullHeight = false,
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

    useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modalContent = (
      <div
        className={`fixed inset-0 bg-black/72 ${zIndexClass} md:backdrop-blur-[8px] flex items-end justify-center md:items-center p-0 md:p-4 transition-all duration-300 touch-none`}
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={`relative bg-[#0e1016] border border-white/[0.08] p-0 rounded-t-[26px] rounded-b-none md:rounded-[24px] shadow-[0_28px_90px_rgba(0,0,0,0.58)] w-full ${maxWidth} flex flex-col ${fullHeight ? "h-[95dvh]" : "max-h-[96dvh] md:max-h-[90dvh]"} text-left overflow-hidden animate-slide-up-sheet md:animate-scale-in touch-auto`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full flex justify-center md:hidden pt-3.5 pb-1.5" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-white/[0.14]" />
          </div>

          {title && (
            <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4.5 border-b border-white/[0.065] bg-[#11141a] flex-shrink-0">
              {typeof title === "string" ? (
                <h3 className="text-[17px] font-bold text-white tracking-[-0.02em]" id="modal-title">
                  {title}
                </h3>
              ) : (
                <div id="modal-title" className="w-full min-w-0">{title}</div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="premium-interactive text-white/45 hover:text-white bg-white/[0.045] hover:bg-white/[0.08] border border-white/[0.055] rounded-[12px] w-10 h-10 ml-auto inline-flex items-center justify-center flex-shrink-0"
                aria-label="Close modal"
              >
                <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          <div
            ref={ref}
            className={`${noPadding ? "p-0" : "p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-6 space-y-6"} flex-1 overflow-y-auto min-h-0 scroll-smooth`}
          >
            {children}
          </div>

          {footer && (
            <div className="flex flex-wrap items-center justify-end px-5 sm:px-6 py-4.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-white/[0.065] bg-[#11141a] flex-shrink-0 gap-2.5 relative z-10">
              {footer}
            </div>
          )}
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  },
);

export default Modal;
