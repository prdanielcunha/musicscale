import React from "react";
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

  const navLinks = [
    { id: "dashboard", to: "/", label: t("nav.bottom.dashboard", "Painel"), icon: <DashboardIcon /> },
    { id: "songs", to: "/songs", label: t("nav.bottom.songs", "Músicas"), icon: <MusicNoteIcon /> },
    { id: "scales", to: "/scales", label: t("nav.bottom.scales", "Escalas"), icon: <CalendarIcon /> },
    { id: "library", to: "/library", label: t("nav.bottom.library", "Biblioteca"), icon: <BookOpenIcon /> },
  ];

  const isLinkActive = (to: string) =>
    location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  const renderLink = (link: (typeof navLinks)[number]) => {
    const isActive = isLinkActive(link.to);
    return (
      <NavLink
        key={link.id}
        to={link.to}
        aria-current={isActive ? "page" : undefined}
        data-active={isActive ? "true" : "false"}
        className="ms-v3-dock-link group flex flex-col items-center justify-center gap-[3px] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        {isActive && !shouldReduceMotion && (
          <motion.span
            layoutId="ms-v3-dock-active-glow"
            aria-hidden="true"
            className="pointer-events-none absolute inset-[3px] -z-10 rounded-[17px] bg-[radial-gradient(circle_at_50%_10%,rgba(111,140,255,0.16),transparent_62%)]"
            transition={{ type: "spring", stiffness: 460, damping: 38, mass: 0.72 }}
          />
        )}
        <span className="relative flex h-[22px] items-center justify-center">
          {React.cloneElement(link.icon as React.ReactElement, {
            className: `h-[20px] w-[20px] transition-all duration-180 ${
              isActive
                ? "text-white drop-shadow-[0_0_10px_rgba(111,140,255,0.35)]"
                : "text-white/[0.42] group-hover:text-white/[0.78]"
            }`,
          })}
        </span>
        <span
          className={`max-w-full truncate px-1 text-center text-[9.5px] leading-[11px] tracking-[-0.01em] transition-colors sm:text-[10px] ${
            isActive ? "font-semibold text-white" : "font-medium text-white/[0.43] group-hover:text-white/[0.72]"
          }`}
        >
          {link.label}
        </span>
      </NavLink>
    );
  };

  return (
    <nav
      aria-label={t("nav.bottom.ariaLabel", "Navegação Principal")}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(9px+env(safe-area-inset-bottom))] z-[100] flex justify-center px-3 md:hidden"
    >
      <div className="w-full max-w-[410px]">
        <div className="ms-v3-dock">
          {renderLink(navLinks[0])}
          {renderLink(navLinks[1])}

          <div className="ms-v3-dock-create-slot" aria-label={t("globalCreate.trigger", "Criar")}>
            <GlobalCreateAction variant="mobile" />
          </div>

          {renderLink(navLinks[2])}
          {renderLink(navLinks[3])}
        </div>
      </div>
    </nav>
  );
};
