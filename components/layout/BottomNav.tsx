import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Menu } from "lucide-react";
import { DashboardIcon } from "../icons/DashboardIcon";
import { BookOpenIcon } from "../icons/BookOpenIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { navigationRegistry } from "./navigationRegistry";

interface BottomNavProps {
  onMenuClick?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onMenuClick }) => {
  const location = useLocation();
  const { t } = useTranslation();

  const dashboardItem = navigationRegistry.find((item) => item.id === "dashboard");
  const repertoireItem = navigationRegistry.find((item) => item.id === "repertoire");
  const scalesItem = navigationRegistry.find((item) => item.id === "scales");
  const libraryItem = navigationRegistry.find((item) => item.id === "library");

  // Bottom nav links, optimized for mobile usage
  const navLinks = [
    {
      id: "dashboard",
      to: "/",
      label: t("nav.dashboard", "Início"),
      icon: dashboardItem?.icon || <DashboardIcon />,
    },
    {
      id: "repertoire",
      to: "/songs",
      label: t("nav.repertoire", "Repertório"),
      icon: repertoireItem?.icon || <MusicNoteIcon />,
    },
    {
      id: "scales",
      to: "/scales",
      label: t("nav.scales", "Escalas"),
      icon: scalesItem?.icon || <CalendarIcon />,
    },
    {
      id: "library",
      to: "/library",
      label: t("nav.library", "Biblioteca"),
      icon: libraryItem?.icon || <BookOpenIcon />,
    },
    {
      id: "menu",
      to: "#",
      label: t("nav.menu", "Menu"),
      icon: <Menu />,
    },
  ];

  return (
    <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[100] flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex justify-between items-center relative w-full max-w-[400px] p-[5px] bg-[#111115]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.10] rounded-[2.25rem] shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.06)]">
        {navLinks.map((link) => {
          const isMenu = link.id === "menu";
          const isActive = !isMenu && location.pathname === link.to;

          const handleClick = (e: React.MouseEvent) => {
            if (isMenu) {
              e.preventDefault();
              if (onMenuClick) {
                onMenuClick();
              }
            }
          };

          return (
            <NavLink
              key={link.id}
              to={link.to}
              onClick={handleClick}
              className={`relative flex h-[54px] flex-1 flex-col items-center justify-center gap-[3px] rounded-[2rem] text-[10px] font-medium transition-colors duration-300 active:scale-[0.92] group ${
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
              <div className="relative z-10 flex items-center justify-center transition-transform duration-300">
                {React.cloneElement(link.icon as React.ReactElement, {
                  className: `w-[22px] h-[22px] transition-all duration-300 ${
                    isActive
                      ? "text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]"
                      : "text-white/50 group-hover:text-white/90"
                  }`,
                })}
              </div>
              <span
                className={`relative z-10 text-[9px] uppercase tracking-widest transition-all duration-300 mt-[1px] ${
                  isActive
                    ? "font-bold text-white drop-shadow-md"
                    : "font-medium text-white/50 group-hover:text-white/90"
                }`}
              >
                {link.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
