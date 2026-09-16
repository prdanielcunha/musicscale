import { useReleaseNews } from '../../hooks/useReleaseNews';
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
  const { hasUnseenRelease, markReleaseSeen } = useReleaseNews();
  const { openHelpModal, openWhatsNew } = useModals();
  const { organization } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    if (!(scrollContainer instanceof HTMLElement)) return;

    const handleScroll = () => setScrolled(scrollContainer.scrollTop > 10);
    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  const getPageTitle = (pathname: string): string => {
    if (pathname.startsWith("/songs")) return t("nav.repertoire", "Repertório");
    if (pathname.startsWith("/band-scales")) return t("nav.band_scales", "Escalas da Banda");
    if (pathname.startsWith("/band")) return t("nav.band", "Integrantes");
    if (pathname.startsWith("/scales")) return t("nav.scales", "Escalas");
    if (pathname.startsWith("/suggestions")) return t("nav.suggestions", "Indicações");
    if (pathname.startsWith("/library")) return t("nav.library", "Biblioteca");
    if (pathname.startsWith("/updates")) return t("nav.updates", "Novidades");
    if (pathname.startsWith("/stage-tools")) return t("nav.stage_tools");

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
      className={`ms-v3-header sticky top-0 z-[70] w-full bg-[#0a0a0c]/96 pt-[max(env(safe-area-inset-top),0px)] transition-all duration-200 md:bg-[#0a0a0c]/88 md:backdrop-blur-[32px] ${
        scrolled
          ? "is-scrolled border-b border-white/[0.07]"
          : "border-b border-transparent"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      <div className="ms-content-frame flex h-[64px] items-center justify-between px-4 sm:h-[72px] md:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="ms-v3-menu-trigger premium-interactive touch-manipulation md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-white/[0.07] text-white/70 hover:text-white"
              aria-label={t("nav.main_menu", "Menu Principal")}
            >
              <MenuIcon className="h-[21px] w-[21px]" />
            </button>
          )}

          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="truncate text-[19px] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[21px]">
                {title}
              </h2>
              <span className="ms-v3-header-signal hidden h-1.5 w-1.5 rounded-full xs:block" aria-hidden="true" />
            </div>
            {organization && (
              <div className="mt-0.5 min-w-0 opacity-90">
                <OrganizationSelector />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="hidden md:block">
            <GlobalCreateAction variant="desktop" />
          </div>

          <button
            onClick={openWhatsNew}
            className="premium-interactive hidden min-h-[40px] items-center gap-2 rounded-[13px] border border-white/[0.07] bg-white/[0.03] px-3.5 text-white/66 hover:border-white/[0.12] hover:bg-white/[0.055] hover:text-white sm:flex"
          >
            {hasUnseenRelease && <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-35 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(79,140,255,0.72)]" />
            </span>}
            <span className="text-[11px] font-semibold tracking-[0.04em]">
              {t('nav.updates')}
            </span>
          </button>

          <button
            onClick={() => openHelpModal("faq")}
            className="premium-interactive hidden h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.07] bg-white/[0.03] text-white/45 hover:border-white/[0.11] hover:bg-white/[0.055] hover:text-white/85 sm:flex"
            aria-label={t("nav.open_help_center", "Abrir central de ajuda")}
          >
            <HelpCircleIcon className="h-[19px] w-[19px]" />
          </button>

          <NotificationBell />
        </div>
      </div>
      {location.pathname === "/" && hasUnseenRelease && (
        <div className="ms-content-frame flex items-center gap-2 border-t border-indigo-400/10 bg-indigo-500/[0.06] px-4 md:px-8">
          <button onClick={openWhatsNew} className="min-h-[44px] min-w-0 flex-1 py-2 text-left text-xs font-medium text-indigo-200 touch-manipulation">
            {t('releaseNews.view')}
          </button>
          <button onClick={markReleaseSeen} aria-label={t('releaseNews.later')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-indigo-200/70 hover:bg-white/5 touch-manipulation">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
