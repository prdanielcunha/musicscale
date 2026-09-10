import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";

export interface MobileSidebarDrawerHandle {
  open: () => void;
  close: () => void;
}

const ExpandedMobileSidebar = memo(function ExpandedMobileSidebar({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <Sidebar
      isCollapsed={false}
      onToggle={onClose}
      onLinkClick={onClose}
    />
  );
});

const MobileSidebarDrawer = forwardRef<MobileSidebarDrawerHandle>(
  function MobileSidebarDrawer(_props, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const { t } = useTranslation();

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    useImperativeHandle(ref, () => ({ open, close }), [close, open]);

    useEffect(() => {
      close();
    }, [close, location.hash, location.pathname]);

    return (
      <>
        <div
          aria-hidden="true"
          className={`md:hidden fixed inset-0 z-[90] bg-black/70 transform-gpu transition-opacity duration-150 touch-manipulation ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={close}
        />

        <div
          aria-hidden={!isOpen}
          inert={!isOpen}
          className={`md:hidden fixed inset-y-0 left-0 z-[100] py-4 pl-4 transform-gpu will-change-transform transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isOpen ? "translate-x-0" : "-translate-x-[calc(100%+4rem)] pointer-events-none"
          }`}
        >
          <ExpandedMobileSidebar onClose={close} />

          <button
            type="button"
            className="absolute top-8 -right-12 w-10 h-10 flex items-center justify-center bg-[#1a1a1d]/95 text-white rounded-full border border-white/[0.08] touch-manipulation active:scale-95 transition-transform duration-100"
            onClick={close}
            aria-label={t("common.close", "Fechar")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </>
    );
  },
);

export default MobileSidebarDrawer;
