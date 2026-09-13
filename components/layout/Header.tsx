import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NotificationBell from "./NotificationBell";
import { HelpCircleIcon } from "../icons/HelpCircleIcon";
import { useModals } from "../../contexts/ModalContext";
import { useAuth } from "../../contexts/AuthContext";
import { MenuIcon } from "../icons/MenuIcon";
import { OrganizationSelector } from "./OrganizationSelector";
import { GlobalCreateAction } from "./GlobalCreateAction";

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { openHelpModal, openWhatsNew } = useModals();
  const { organization } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector('main');
    const handleScroll = () => {
      const top = scrollContainer instanceof HTMLElement ? scrollContainer.scrollTop : window.scrollY;
      setScrolled(top > 8);
    };

    scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      scrollContainer?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const getPageTitle = (pathname: string): string => {
    if (pathname.startsWith("/songs")) return t("nav.repertoire", "Repertório");
    if (pathname.startsWith("/band-scales")) return t("nav.band_scales", "Escalas da Banda");
    if (pathname.startsWith("/band")) return t("nav.band", "Integrantes");
    if (pathname.startsWith("/scales")) return t("nav.scales", "Escalas");
    if (pathname.startsWith("/suggestions")) return t("nav.suggestions", "Indicações");
    if (pathname.startsWith("/library")) return t("nav.library", "Biblioteca");
    if (pathname.startsWith("/updates")) return t("nav.updates", "Novidades");
    if (pathname.startsWith("/notifications")) return t("nav.notifications", "Notificações");

    switch (pathname) {
      case "/": return t("nav.dashboard", "Painel");
      case "/chords": return t("nav.chords", "Cifras");
      case "/lyrics": return t("nav.lyrics", "Letras");
      case "/database": return t("nav.database", "Banco de Dados");
      case "/profile": return t("nav.account", "Meu Perfil");
      case "/users": return t("nav.members", "Usuários");
      case "/roles": return t("nav.roles", "Funções");
      case "/backup": return t("nav.backup", "Backup de Sistema");
      default: return "MusicScale";
    }
  };

  const title = getPageTitle(location.pathname);

  return (
    <header
      className={`sticky top-0 z-[70] w-full pt-[max(env(safe-area-inset-top),0px)] border-b transition-[background-color,border-color,box-shadow] duration-200 ${
        scrolled
          ? "ms-premium-header border-white/[0.055] shadow-[0_10px_30px_rgba(0,0,0,0.14)]"
          : "bg-[#07080b]/80 border-white/[0.035] md:bg-transparent"
      }`}
    >
      <div className="flex items-center justify-between h-[62px] sm:h-[68px] px-4 md:px-7 lg:px-8 relative z-10">
        <div className="flex items-center gap-3 min-w-0 touch-manipulation">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden premium-interactive flex items-center justify-center w-11 h-11 -ml-1 rounded-[14px] text-slate-300 bg-[#11141a] border border-white/[0.07] active:bg-[#171b23]"
              aria-label={t("nav.main_menu", "Menu Principal")}
            >
              <MenuIcon className="w-[21px] h-[21px]" />
            </button>
          )}
          <div className="flex flex-col min-w-0 justify-center">
            <h2 className="text-[18px] sm:text-[20px] font-bold text-white truncate tracking-[-0.025em] leading-tight">
              {title}
            </h2>
            {organization && (
              <div className="mt-0.5 max-w-[58vw] sm:max-w-none">
                <OrganizationSelector />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:block">
            <GlobalCreateAction variant="desktop" />
          </div>
          <button
            onClick={openWhatsNew}
            className="hidden sm:flex premium-interactive min-h-10 items-center gap-2 px-3.5 rounded-[13px] bg-[#11141a] border border-white/[0.07] hover:bg-[#171b23] hover:border-white/[0.11]"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-30"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
            </span>
            <span className="text-[11px] font-semibold tracking-[0.02em] text-slate-300">
              {t("nav.updates", "Atualizações")}
            </span>
          </button>
          <button
            onClick={() => openHelpModal("faq")}
            className="hidden sm:flex premium-interactive w-10 h-10 items-center justify-center rounded-[13px] text-slate-400 hover:text-white bg-[#11141a] border border-white/[0.07] hover:bg-[#171b23]"
            aria-label={t("nav.open_help_center", "Abrir central de ajuda")}
          >
            <HelpCircleIcon className="w-[19px] h-[19px]" />
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
};

export default Header;
