import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { DashboardIcon } from "../icons/DashboardIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { BookOpenIcon } from "../icons/BookOpenIcon";
import { SettingsIcon } from "../icons/SettingsIcon";
import { GlobalCreateAction } from "./GlobalCreateAction";

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();

  const navLinks = [
    {
      id: "dashboard",
      to: "/",
      label: t("nav.bottom.dashboard", "Painel"),
      icon: <DashboardIcon />,
    },
    {
      id: "songs",
      to: "/songs",
      label: t("nav.bottom.songs", "Músicas"),
      icon: <MusicNoteIcon />,
    },
    {
      id: "scales",
      to: "/scales",
      label: t("nav.bottom.scales", "Escalas"),
      icon: <CalendarIcon />,
    },
    {
      id: "library",
      to: "/library",
      label: t("nav.bottom.library", "Biblioteca"),
      icon: <BookOpenIcon />,
    },
    {
      id: "account",
      to: "/profile",
      label: t("nav.bottom.account", "Conta"),
      icon: <SettingsIcon />,
    },
  ];

  const getActiveIndex = () => {
    return navLinks.findIndex(link => 
      location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to))
    );
  };

  const activeIndex = getActiveIndex();
  const previousIndexRef = useRef(activeIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (activeIndex !== previousIndexRef.current) {
      setDirection(activeIndex > previousIndexRef.current ? 1 : -1);
      previousIndexRef.current = activeIndex;
    }
  }, [activeIndex]);

  // Spring configuration for fluid motion
  const springTransition = {
    type: "spring",
    stiffness: 520,
    damping: 42,
    mass: 0.72,
  };

  const fallbackTransition = {
    duration: 0,
  };

  const transition = shouldReduceMotion ? fallbackTransition : springTransition;

  return (
    <nav aria-label={t("nav.bottom.ariaLabel", "Navegação Principal")} className="md:hidden fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-0 right-0 z-[100] flex justify-center pointer-events-none px-3">
      <div className="relative w-full max-w-[390px]">
        {/* Global Create Action */}
        <div className="absolute right-2 sm:right-3 bottom-[calc(100%+12px)] pointer-events-auto">
          <GlobalCreateAction variant="mobile" />
        </div>

        {/* Bottom Nav Bar */}
        <div className="pointer-events-auto flex justify-between items-center relative w-full p-[4px] bg-[rgba(13,13,17,0.76)] backdrop-blur-[24px] saturate-[150%] border border-white/[0.08] rounded-[31px] shadow-[0_18px_48px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {navLinks.map((link, index) => {
            const isActive = index === activeIndex;

            return (
              <NavLink
                key={link.id}
                to={link.to}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-[50px] w-full min-w-[48px] flex-1 flex-col items-center justify-center rounded-[26px] transition-colors duration-150 active:scale-[0.97] group overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-liquid-indicator"
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.11)_55%,rgba(255,255,255,0.07)_100%)] backdrop-blur-[16px] rounded-[26px] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.13),inset_0_-1px_0_rgba(255,255,255,0.03),0_7px_18px_rgba(0,0,0,0.20)] -z-10"
                    transition={transition}
                  >
                    {!shouldReduceMotion && direction !== 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: direction * -20 }}
                        animate={{ opacity: [0, 0.5, 0], x: [direction * -20, direction * 20] }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none rounded-[26px]"
                      />
                    )}
                  </motion.div>
                )}
                
                {/* Icon wrapper */}
                <div className="relative z-10 flex h-[22px] items-center justify-center">
                  {React.cloneElement(link.icon as React.ReactElement, {
                    className: `w-[20px] h-[20px] sm:w-[21px] sm:h-[21px] transition-colors duration-150 ${
                      isActive
                        ? "text-white"
                        : "text-white/[0.55] group-hover:text-white/[0.85]"
                    }`,
                  })}
                </div>
                
                {/* Text wrapper */}
                <div className="mt-[2px] flex items-center justify-center w-full px-1">
                  <span
                    className={`relative z-10 w-full text-center truncate whitespace-nowrap leading-[12px] transition-colors duration-150 text-[10.5px] sm:text-[11px] ${
                      isActive
                        ? "font-semibold text-white"
                        : "font-medium text-white/[0.55] group-hover:text-white/[0.85]"
                    }`}
                  >
                    {link.label}
                  </span>
                </div>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
