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
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getPageTitle = (pathname: string): string => {
    if (pathname.startsWith("/songs")) return t("nav.repertoire", "Repertório");
    if (pathname.startsWith("/band-scales")) return t("nav.band_scales", "Escalas da Banda");
    if (pathname.startsWith("/band")) return t("nav.band", "Integrantes");
    if (pathname.startsWith("/scales")) return t("nav.scales", "Escalas");
    if (pathname.startsWith("/suggestions")) return t("nav.suggestions", "Indicações");
    if (pathname.startsWith("/library")) return t("nav.library", "Biblioteca");
    if (pathname.startsWith("/updates")) return t("nav.updates", "Novidades");

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
      className={`sticky top-0 z-[70] w-full pt-[max(env(safe-area-inset-top),0px)] transition-all duration-200 ${
        scrolled
          ? "bg-[#0a0a0c]/96 md:bg-[#08080b]/[0.985] md:backdrop-blur-[32px] border-b border-white/[0.075] shadow-[0_14px_38px_-28px_rgba(0,0,0,0.95)]"
          : "bg-[#070709]/[0.88] md:backdrop-blur-[32px] border-b border-white/[0.04]"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="ms-content-frame flex h-[64px] items-center justify-between px-4 sm:h-[72px] md:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="premium-interactive touch-manipulation md:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.07] bg-white/[0.035] text-white/70 hover:bg-white/[0.06] hover:text-white"
              aria-label={t("nav.main_menu", "Menu Principal")}
            >
              <MenuIcon className="h-[21px] w-[21px]" />
            </button>
          )}

          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[20px]">
                {title}
              </h2>
              <span className="hidden h-1.5 w-1.5 rounded-full bg-primary/70 shadow-[0_0_12px_rgba(79,140,255,0.65)] xs:block" aria-hidden="true" />
            </div>
            {organization && (
              <div className="mt-0.5 min-w-0">
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
            className="premium-interactive hidden min-h-[40px] items-center gap-2 rounded-[13px] border border-white/[0.07] bg-white/[0.035] px-3.5 text-white/70 hover:border-white/[0.11] hover:bg-white/[0.055] hover:text-white sm:flex"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-45" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(79,140,255,0.65)]" />
            </span>
            <span className="text-[11px] font-semibold tracking-[0.04em]">
              {t("nav.updates", "Atualizações")}
            </span>
          </button>

          <button
            onClick={() => openHelpModal("faq")}
            className="premium-interactive hidden h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.07] bg-white/[0.035] text-white/50 hover:border-white/[0.11] hover:bg-white/[0.055] hover:text-white/85 sm:flex"
            aria-label={t("nav.open_help_center", "Abrir central de ajuda")}
          >
            <HelpCircleIcon className="h-[19px] w-[19px]" />
          </button>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
};

export default Header;
