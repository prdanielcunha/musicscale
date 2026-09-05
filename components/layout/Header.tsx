import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NotificationBell from "./NotificationBell";
import { HelpCircleIcon } from "../icons/HelpCircleIcon";
import { useModals } from "../../contexts/ModalContext";
import { useAuth } from "../../contexts/AuthContext";
import { MenuIcon } from "../icons/MenuIcon";
import { Sparkles } from "lucide-react";
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
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

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
      case "/":
        return t("nav.dashboard", "Painel");
      case "/chords":
        return t("nav.chords", "Cifras");
      case "/database":
        return t("nav.database", "Banco de Dados");
      case "/profile":
        return t("nav.account", "Meu Perfil");
      case "/users":
        return t("nav.members", "Usuários");
      case "/roles":
        return t("nav.roles", "Funções");
      case "/backup":
        return t("nav.backup", "Backup de Sistema");
      default:
        return "MusicScale";
    }
  };

  const title = getPageTitle(location.pathname);

  return (
    <>
      <header 
        className={`sticky top-0 z-[70] w-full pt-[max(env(safe-area-inset-top),0px)] transition-all duration-300 ${
          scrolled 
            ? "bg-[#0a0a0c]/80 backdrop-blur-[32px] saturate-[180%] border-b border-white/[0.06] shadow-[0_4px_24px_-6px_rgba(0,0,0,0.3)]" 
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none -z-10" />
        
        <div className="flex items-center justify-between h-[64px] sm:h-[72px] px-4 md:px-8 relative z-10">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {onMenuClick && (
              <button
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") onMenuClick();
                }}
                onClick={onMenuClick}
                className="md:hidden touch-manipulation flex items-center justify-center w-10 h-10 -ml-2 rounded-[14px] text-slate-300 active:scale-95 transition-all duration-150 bg-white/[0.03] active:bg-white/[0.06] border border-white/[0.05]"
                aria-label={t("nav.main_menu", "Menu Principal")}
              >
                <MenuIcon className="w-[22px] h-[22px]" />
              </button>
            )}
            <div className="flex flex-col min-w-0 justify-center">
              <h2 className="text-lg sm:text-[20px] font-bold text-white/95 truncate tracking-tight leading-tight">
                {title}
              </h2>
              {organization && (
                <div className="mt-0.5">
                  <OrganizationSelector />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:block">
              <GlobalCreateAction variant="desktop" />
            </div>
            <button
              onClick={openWhatsNew}
              className="hidden sm:flex relative items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#18181b]/60 border border-indigo-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-md premium-interactive hover:bg-[#18181b] hover:border-indigo-500/30"
            >
              <div className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-indigo-500"></span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.1em] text-indigo-300">
                {t("nav.updates", "Atualizações")}
              </span>
            </button>
            <button
              onClick={() => openHelpModal("faq")}
              className="hidden sm:flex relative w-9 h-9 sm:w-10 sm:h-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-200 bg-[#18181b]/60 border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-md premium-interactive"
              aria-label={t("nav.open_help_center", "Abrir central de ajuda")}
            >
              <HelpCircleIcon className="w-5 h-5" />
            </button>
            <NotificationBell />
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;

