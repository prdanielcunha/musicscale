import { useTranslation } from "react-i18next";
import React, { useRef, useId, useEffect, forwardRef, ForwardedRef } from "react";
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
    const { t } = useTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
      if (!isOpen) return;
      const previous = document.activeElement as HTMLElement | null;
      const dialog = dialogRef.current;
      const focusable = (): HTMLElement[] => dialog
        ? Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')) as HTMLElement[]
        : [];
      const preferred = dialog?.querySelector('[autofocus]') as HTMLElement | null;
      (preferred || focusable()[0] || dialog)?.focus();
      const handleKey = (event: KeyboardEvent) => {
        if (!dialog?.contains(document.activeElement)) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
        if (event.key === 'Tab') {
          const items = focusable();
          const first = items[0], last = items[items.length - 1];
          if (!first) { event.preventDefault(); dialog.focus(); }
          else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      };
      dialog?.addEventListener('keydown', handleKey);
      return () => { dialog?.removeEventListener('keydown', handleKey); previous?.focus(); };
    }, [isOpen]);

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
        className={`fixed inset-0 ${zIndexClass} flex touch-none items-end justify-center bg-black/[0.74] p-0 md:items-center md:p-4`}
        aria-labelledby={title ? titleId : undefined}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={`relative flex w-full ${maxWidth} ${fullHeight ? "h-[95dvh]" : "max-h-[96dvh] md:max-h-[90dvh]"} touch-auto flex-col overflow-hidden rounded-t-[26px] border border-white/[0.09] bg-[linear-gradient(180deg,#17171e_0%,#0d0d12_100%)] text-left shadow-[0_36px_100px_-28px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.05)] animate-slide-up-sheet md:animate-scale-in motion-reduce:animate-none md:rounded-[24px]`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex w-full justify-center pb-1 pt-3.5 md:hidden" onClick={onClose}>
            <div className="h-1 w-10 rounded-full bg-white/[0.14]" />
          </div>

          {title && (
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] bg-white/[0.015] px-5 py-4.5 sm:px-6 sm:py-5">
              {typeof title === "string" ? (
                <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-white" id={titleId}>
                  {title}
                </h3>
              ) : (
                <div id={titleId} className="w-full">{title}</div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="premium-interactive ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-white/[0.065] bg-white/[0.035] text-white/45 hover:border-white/[0.11] hover:bg-white/[0.065] hover:text-white"
              >
                <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="sr-only">{t("common.close")}</span>
              </button>
            </div>
          )}

          <div
            ref={ref}
            className={`${noPadding ? "p-0" : "space-y-6 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 md:pb-6"} min-h-0 flex-1 overflow-y-auto scroll-smooth motion-reduce:scroll-auto`}
          >
            {children}
          </div>

          {footer && (
            <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/[0.07] bg-white/[0.018] px-5 py-4.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
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
