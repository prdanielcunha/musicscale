import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { DashboardIcon } from "../icons/DashboardIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { BookOpenIcon } from "../icons/BookOpenIcon";
import { SettingsIcon } from "../icons/SettingsIcon";
import { GlobalCreateAction } from "./GlobalCreateAction";

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();

  // Bottom nav links, optimized for mobile usage
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

  return (
    <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[100] flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex justify-between items-center relative w-full max-w-[400px] p-[5px] bg-[#111115]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.10] rounded-[2.25rem] shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.06)]">
        <GlobalCreateAction variant="mobile" />
        {navLinks.map((link) => {
          const isActive = location.pathname === link.to || (link.to !== "/" && location.pathname.startsWith(link.to));

          return (
            <NavLink
              key={link.id}
              to={link.to}
              className={`relative flex h-[54px] w-full min-w-0 flex-1 flex-col items-center justify-center rounded-[2rem] transition-colors duration-300 active:scale-[0.92] group overflow-hidden ${
                isActive
                  ? "text-white"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.04]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active-pill"
                  className="absolute inset-0 bg-white/[0.12] backdrop-blur-[24px] rounded-[2rem] border border-white/[0.10] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_0_12px_rgba(255,255,255,0.03)] -z-10"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              
              {/* Icon wrapper with fixed height */}
              <div className="relative z-10 flex h-[22px] items-center justify-center transition-transform duration-300">
                {React.cloneElement(link.icon as React.ReactElement, {
                  className: `w-[21px] h-[21px] sm:w-[22px] sm:h-[22px] transition-all duration-300 ${
                    isActive
                      ? "text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
                      : "text-white/50 group-hover:text-white/90"
                  }`,
                })}
              </div>
              
              {/* Text wrapper with fixed height and no wrap */}
              <div className="mt-[3px] flex h-[10px] w-full min-w-0 items-center justify-center overflow-hidden px-1">
                <span
                  className={`relative z-10 w-full min-w-0 truncate whitespace-nowrap text-center leading-none transition-all duration-300 text-[8px] tracking-[0.10em] sm:text-[9px] sm:tracking-widest ${
                    isActive
                      ? "font-bold text-white drop-shadow-md"
                      : "font-medium text-white/50 group-hover:text-white/90"
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
  );
};

