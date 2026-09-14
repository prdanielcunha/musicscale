import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { DashboardIcon } from "../icons/DashboardIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { BookOpenIcon } from "../icons/BookOpenIcon";
import { GlobalCreateAction } from "./GlobalCreateAction";

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();

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

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 500, damping: 42, mass: 0.72 };

  return (
    <nav
      aria-label={t("nav.bottom.ariaLabel", "Navegação Principal")}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(10px+env(safe-area-inset-bottom))] z-[100] flex justify-center px-3 md:hidden"
    >
      <div className="relative w-full max-w-[400px]">
        <div className="pointer-events-auto relative flex w-full items-center justify-between rounded-[28px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(24,24,29,0.98),rgba(9,9,12,0.995))] p-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.46)]">
          {navLinks.map((link, index) => {
            const isActive = index === activeIndex;
            return (
              <React.Fragment key={link.id}>
                {index === 2 && (
                  <div className="flex min-w-11 flex-1 justify-center">
                    <GlobalCreateAction variant="mobile" />
                  </div>
                )}
                <NavLink
                  to={link.to}
                  aria-current={isActive ? "page" : undefined}
                  className="group relative flex h-[50px] min-w-[44px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[24px] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none"
                >
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-liquid-indicator"
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-[24px] border border-white/[0.105] bg-[linear-gradient(180deg,rgba(255,255,255,0.105),rgba(255,255,255,0.05))] shadow-[inset_0_1px_0_rgba(255,255,255,0.075)]"
                      transition={transition}
                    >
                      <div className="absolute inset-x-[28%] top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
                      {!shouldReduceMotion && direction !== 0 && (
                        <motion.div
                          initial={{ opacity: 0, x: direction * -16 }}
                          animate={{ opacity: [0, 0.38, 0], x: [direction * -16, direction * 16] }}
                          transition={{ duration: 0.32, ease: "easeInOut" }}
                          className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
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

                  <span className={`relative z-10 mt-[2px] w-full truncate px-1 text-center text-[10px] leading-[12px] transition-colors duration-150 sm:text-[10.5px] ${
                    isActive ? "font-semibold text-white" : "font-medium text-white/[0.46] group-hover:text-white/[0.78]"
                  }`}>
                    {link.label}
                  </span>
                </NavLink>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
