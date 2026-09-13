import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import { beginInteractionPaintMeasurement } from "../../lib/interactionTelemetry";

export interface MobileSidebarDrawerHandle {
  open: () => void;
  close: () => void;
}

const DRAWER_TRANSITION_MS = 240;

const ExpandedMobileSidebar = memo(function ExpandedMobileSidebar({ onClose }: { onClose: () => void }) {
  return (
    <div className="ms-v3-command-frame h-full w-full">
      <Sidebar isCollapsed={false} onToggle={onClose} onLinkClick={onClose} />
    </div>
  );
});

const MobileSidebarDrawer = forwardRef<MobileSidebarDrawerHandle>(
  function MobileSidebarDrawer(_props, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [isInteractive, setIsInteractive] = useState(false);
    const inertTimerRef = useRef<number | null>(null);
    const closeMeasurementRef = useRef<ReturnType<typeof beginInteractionPaintMeasurement> | null>(null);
    const location = useLocation();
    const { t } = useTranslation();

    const clearInertTimer = useCallback(() => {
      if (inertTimerRef.current !== null) {
        window.clearTimeout(inertTimerRef.current);
        inertTimerRef.current = null;
      }
    }, []);

    const open = useCallback(() => {
      const finishMeasurement = beginInteractionPaintMeasurement('mobile_drawer_open_to_paint_ms');
      clearInertTimer();
      setIsInteractive(true);
      setIsOpen(true);
      finishMeasurement();
    }, [clearInertTimer]);

    const close = useCallback(() => {
      const finishMeasurement = closeMeasurementRef.current
        ?? beginInteractionPaintMeasurement('mobile_drawer_close_to_paint_ms');
      closeMeasurementRef.current = null;
      setIsOpen(false);
      finishMeasurement();

      clearInertTimer();
      inertTimerRef.current = window.setTimeout(() => {
        setIsInteractive(false);
        inertTimerRef.current = null;
      }, DRAWER_TRANSITION_MS + 30);
    }, [clearInertTimer]);

    const beginMeasuredClose = useCallback(() => {
      closeMeasurementRef.current = beginInteractionPaintMeasurement('mobile_drawer_close_to_paint_ms');
    }, []);

    useImperativeHandle(ref, () => ({ open, close }), [close, open]);

    useEffect(() => {
      close();
    }, [close, location.hash, location.pathname]);

    useEffect(() => () => {
      clearInertTimer();
    }, [clearInertTimer]);

    return (
      <>
        <div
          aria-hidden="true"
          className={`ms-v3-drawer-backdrop fixed inset-0 z-[90] transform-gpu transition-opacity duration-200 touch-manipulation md:hidden ${
            isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onPointerDown={beginMeasuredClose}
          onClick={close}
        />

        <div
          aria-hidden={!isInteractive}
          inert={!isInteractive}
          className={`ms-v3-command-drawer fixed inset-y-0 left-0 z-[100] transform-gpu transition-[transform,opacity] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform md:hidden ${
            isOpen
              ? "translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-[calc(100%+2rem)] opacity-70"
          }`}
        >
          <ExpandedMobileSidebar onClose={close} />

          <button
            type="button"
            className="ms-v3-command-close premium-interactive"
            onPointerDown={beginMeasuredClose}
            onClick={close}
            aria-label={t("common.close", "Fechar")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </>
    );
  },
);

export default MobileSidebarDrawer;
