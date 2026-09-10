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

const DRAWER_TRANSITION_MS = 150;

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

      // Paint the transform/opacity close first. Applying `inert` immediately to
      // the full navigation subtree makes WebKit update focus/accessibility while
      // the closing frame is trying to render, which needlessly extends input-to-paint.
      setIsOpen(false);
      finishMeasurement();

      clearInertTimer();
      inertTimerRef.current = window.setTimeout(() => {
        setIsInteractive(false);
        inertTimerRef.current = null;
      }, DRAWER_TRANSITION_MS + 20);
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
          className={`md:hidden fixed inset-0 z-[90] bg-black/72 transform-gpu transition-opacity duration-150 touch-manipulation ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onPointerDown={beginMeasuredClose}
          onClick={close}
        />

        <div
          aria-hidden={!isInteractive}
          inert={!isInteractive}
          className={`md:hidden fixed inset-y-0 left-0 z-[100] py-4 pl-4 transform-gpu will-change-transform transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isOpen ? "translate-x-0" : "-translate-x-[calc(100%+4rem)] pointer-events-none"
          }`}
        >
          <ExpandedMobileSidebar onClose={close} />

          <button
            type="button"
            className="absolute top-8 -right-12 w-10 h-10 flex items-center justify-center bg-[#1a1a1d]/98 text-white rounded-full border border-white/[0.08] touch-manipulation active:scale-95 transition-transform duration-100"
            onPointerDown={beginMeasuredClose}
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
