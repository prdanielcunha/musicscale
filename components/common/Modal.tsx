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
        className={`fixed inset-0 bg-slate-900/60 dark:bg-black/70 ${zIndexClass} backdrop-blur-xl flex items-end justify-center md:items-center p-0 md:p-4 transition-all duration-400 touch-none`}
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
        onPointerDown={(e) => {
           // On pointer down, stop bubbling to avoid passing actions to background elements
           if (e.target === e.currentTarget) {
             onClose();
           }
        }}
      >
        <div
          className={`relative bg-surface dark:bg-[#0A0A0C] border border-transparent md:border-slate-200/50 md:dark:border-white/[0.08] p-0 rounded-t-[32px] rounded-b-none md:rounded-[32px] shadow-2xl md:shadow-[0_20px_60px_rgba(0,0,0,0.6)] w-full ${maxWidth} flex flex-col ${fullHeight ? "h-[95dvh]" : "max-h-[96dvh] md:max-h-[90dvh]"} text-left overflow-hidden animate-slide-up-sheet md:animate-scale-in touch-auto`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Drag Indicator */}
          <div
            className="w-full flex justify-center md:hidden pt-4 pb-2"
            onClick={onClose}
                aria-label="Close"
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-white/10"></div>
          </div>

          {title && (
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/50 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] backdrop-blur-md flex-shrink-0">
              {typeof title === "string" ? (
                <h3
                  className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight"
                  id="modal-title"
                >
                  {title}
                </h3>
              ) : (
                <div id="modal-title" className="w-full">
                  {title}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-slate-500 dark:text-white/40 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-full p-2.5 ml-auto inline-flex items-center flex-shrink-0 transition-all hover:scale-105 active:scale-95"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                <span className="sr-only">Close modal</span>
              </button>
            </div>
          )}

          <div
            ref={ref}
            className={`${noPadding ? "p-0" : "p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-6 space-y-6"} flex-1 overflow-y-auto min-h-0 scroll-smooth`}
          >
            {children}
          </div>

          {footer && (
            <div className="flex flex-wrap items-center justify-end px-6 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-slate-200/50 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex-shrink-0 gap-3 relative z-10">
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
