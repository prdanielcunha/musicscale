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
    { id: "dashboard", to: "/", label: t("nav.bottom.dashboard", "Painel"), icon: <DashboardIcon /> },
    { id: "songs", to: "/songs", label: t("nav.bottom.songs", "Músicas"), icon: <MusicNoteIcon /> },
    { id: "scales", to: "/scales", label: t("nav.bottom.scales", "Escalas"), icon: <CalendarIcon /> },
    { id: "library", to: "/library", label: t("nav.bottom.library", "Biblioteca"), icon: <BookOpenIcon /> },
    { id: "account", to: "/profile", label: t("nav.bottom.account", "Conta"), icon: <SettingsIcon /> },
  ];

  const getActiveIndex = () => navLinks.findIndex(link =>
    location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to))
  );

  const activeIndex = getActiveIndex();
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
    : { type: "spring" as const, stiffness: 500, damping: 44, mass: 0.7 };

  return (
    <nav
      aria-label={t("nav.bottom.ariaLabel", "Navegação Principal")}
      className="md:hidden fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-0 right-0 z-[100] flex justify-center pointer-events-none px-3"
    >
      <div className="relative w-full max-w-[402px]">
        <div className="absolute right-2 bottom-[calc(100%+10px)] pointer-events-auto">
          <GlobalCreateAction variant="mobile" />
        </div>

        <div className="ms-premium-bottom-nav pointer-events-auto flex items-center relative w-full p-[4px] rounded-[29px]">
          {navLinks.map((link, index) => {
            const isActive = index === activeIndex;
            return (
              <NavLink
                key={link.id}
                to={link.to}
                aria-current={isActive ? "page" : undefined}
                className="relative flex h-[51px] min-w-[48px] flex-1 flex-col items-center justify-center rounded-[25px] transition-colors duration-150 active:scale-[0.975] group overflow-hidden focus:outline-none"
              >
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-premium-v2-indicator"
                    aria-hidden="true"
                    className="ms-premium-bottom-active absolute inset-0 rounded-[25px] -z-10"
                    transition={transition}
                  >
                    {!shouldReduceMotion && direction !== 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: direction * -14 }}
                        animate={{ opacity: [0, 0.34, 0], x: [direction * -14, direction * 14] }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent pointer-events-none rounded-[25px]"
                      />
                    )}
                  </motion.div>
                )}

                <div className="relative z-10 flex h-[22px] items-center justify-center">
                  {React.cloneElement(link.icon as React.ReactElement, {
                    className: `w-[20px] h-[20px] transition-[color,transform] duration-150 ${
                      isActive ? "text-[#aeb2ff] scale-[1.03]" : "text-white/[0.48] group-hover:text-white/[0.78]"
                    }`,
                  })}
                </div>

                <span className={`relative z-10 mt-[2px] max-w-full px-1 truncate text-center whitespace-nowrap leading-[12px] text-[10.5px] transition-colors duration-150 ${
                  isActive ? "font-semibold text-white" : "font-medium text-white/[0.48] group-hover:text-white/[0.78]"
                }`}>
                  {link.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
