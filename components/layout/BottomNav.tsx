import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { DashboardIcon } from "../icons/DashboardIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { BookOpenIcon } from "../icons/BookOpenIcon";
import { GlobalCreateAction } from "./GlobalCreateAction";

const COMPACT_AFTER_PX = 92;
const SCROLL_DIRECTION_THRESHOLD_PX = 10;

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [isCompact, setIsCompact] = useState(false);
  const [isPerformanceActive, setIsPerformanceActive] = useState(false);
  const previousScrollTopRef = useRef(0);

  // Four destinations + the centered Create action keep the mobile dock to five
  // intentional slots. Account remains available through the existing menu/header.
  const navLinks = [
    { id: "dashboard", to: "/", label: t("nav.bottom.dashboard", "Painel"), icon: <DashboardIcon /> },
    { id: "songs", to: "/songs", label: t("nav.bottom.songs", "Músicas"), icon: <MusicNoteIcon /> },
    { id: "scales", to: "/scales", label: t("nav.bottom.scales", "Escalas"), icon: <CalendarIcon /> },
    { id: "library", to: "/library", label: t("nav.bottom.library", "Biblioteca"), icon: <BookOpenIcon /> },
  ];

  const activeIndex = navLinks.findIndex(link =>
    location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to))
  );
  const previousIndexRef = useRef(activeIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (activeIndex !== previousIndexRef.current) {
      setDirection(activeIndex > previousIndexRef.current ? 1 : -1);
      previousIndexRef.current = activeIndex;
    }
  }, [activeIndex]);

  useEffect(() => {
    setIsCompact(false);
    previousScrollTopRef.current = 0;

    const scrollContainer = document.querySelector("main");
    if (!(scrollContainer instanceof HTMLElement)) return;

    const handleScroll = () => {
      const current = scrollContainer.scrollTop;
      const delta = current - previousScrollTopRef.current;

      if (current <= 28) {
        setIsCompact(false);
      } else if (current >= COMPACT_AFTER_PX && delta > SCROLL_DIRECTION_THRESHOLD_PX) {
        setIsCompact(true);
      } else if (delta < -SCROLL_DIRECTION_THRESHOLD_PX) {
        setIsCompact(false);
      }

      previousScrollTopRef.current = current;
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  // Performance is intentionally content-first. The existing performance viewer owns
  // this stable test id, so the global dock recedes while that surface is mounted
  // without creating a second source of truth for performance state.
  useEffect(() => {
    const syncPerformanceState = () => {
      setIsPerformanceActive(
        Boolean(document.querySelector('[data-testid="close-chords-viewer"]')),
      );
    };

    syncPerformanceState();
    const observer = new MutationObserver(syncPerformanceState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 500, damping: 42, mass: 0.72 };

  if (isPerformanceActive) return null;

  return (
    <motion.nav
      aria-label={t("nav.bottom.ariaLabel", "Navegação Principal")}
      data-testid="adaptive-bottom-nav"
      data-compact={isCompact ? "true" : "false"}
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(10px+env(safe-area-inset-bottom))] z-[100] flex justify-center px-3 md:hidden"
    >
      <motion.div
        className="relative w-full"
        animate={{ maxWidth: isCompact ? 342 : 400 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="pointer-events-auto relative flex w-full items-center justify-between border border-white/[0.09] bg-[linear-gradient(180deg,rgba(24,24,29,0.98),rgba(9,9,12,0.995))] p-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.46)]"
          animate={{ borderRadius: isCompact ? 22 : 28 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
        >
          {navLinks.map((link, index) => {
            const isActive = index === activeIndex;
            return (
              <React.Fragment key={link.id}>
                {index === 2 && (
                  <motion.div
                    className="flex min-w-11 flex-1 justify-center"
                    animate={{ scale: isCompact ? 0.92 : 1 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                  >
                    <GlobalCreateAction variant="mobile" />
                  </motion.div>
                )}
                <NavLink
                  to={link.to}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={link.label}
                  className={`group relative flex min-w-[44px] flex-1 flex-col items-center justify-center overflow-hidden transition-[height,transform] duration-200 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none ${
                    isCompact ? "h-[44px] rounded-[19px]" : "h-[50px] rounded-[24px]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-liquid-indicator"
                      aria-hidden="true"
                      className={`absolute inset-0 -z-10 border border-white/[0.105] bg-[linear-gradient(180deg,rgba(255,255,255,0.105),rgba(255,255,255,0.05))] shadow-[inset_0_1px_0_rgba(255,255,255,0.075)] ${
                        isCompact ? "rounded-[19px]" : "rounded-[24px]"
                      }`}
                      transition={transition}
                    >
                      <div className="absolute inset-x-[28%] top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
                      {!shouldReduceMotion && direction !== 0 && (
                        <motion.div
                          initial={{ opacity: 0, x: direction * -16 }}
                          animate={{ opacity: [0, 0.38, 0], x: [direction * -16, direction * 16] }}
                          transition={{ duration: 0.32, ease: "easeInOut" }}
                          className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent ${
                            isCompact ? "rounded-[19px]" : "rounded-[24px]"
                          }`}
                        />
                      )}
                    </motion.div>
                  )}

                  <div className="relative z-10 flex h-[22px] items-center justify-center">
                    {React.cloneElement(link.icon as React.ReactElement, {
                      className: `h-[20px] w-[20px] transition-colors duration-150 sm:h-[21px] sm:w-[21px] ${
                        isActive ? "text-white" : "text-white/[0.48] group-hover:text-white/[0.8]"
                      }`,
                    })}
                  </div>

                  <span
                    aria-hidden={isCompact ? "true" : undefined}
                    className={`relative z-10 w-full truncate px-1 text-center text-[10px] leading-[12px] transition-[opacity,max-height,margin] duration-180 sm:text-[10.5px] ${
                      isActive ? "font-semibold text-white" : "font-medium text-white/[0.46] group-hover:text-white/[0.78]"
                    } ${isCompact ? "mt-0 max-h-0 opacity-0" : "mt-[2px] max-h-4 opacity-100"}`}
                  >
                    {link.label}
                  </span>
                </NavLink>
              </React.Fragment>
            );
          })}
        </motion.div>
      </motion.div>
    </motion.nav>
  );
};
