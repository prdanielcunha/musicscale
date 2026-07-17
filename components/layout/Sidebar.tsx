import { logger } from "../../lib/logger";

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPrimaryDisplayRole, getRoleBadgeStyles } from '../../utils/roleResolver';
import { LanguageSelector } from "./LanguageSelector";
import { useAuth } from "../../contexts/AuthContext";
import { signOutUser } from "../../services/authService";
import { useEcosystemAdmin } from "../../hooks/useEcosystemAdmin";
import { DashboardIcon } from "../icons/DashboardIcon";
import { RepertoireIcon } from "../icons/RepertoireIcon";
import { CalendarIcon } from "../icons/CalendarIcon";
import { DatabaseIcon } from "../icons/DatabaseIcon";
import { ChordsIcon } from "../icons/ChordsIcon";
import { FileText, ShieldAlert } from "lucide-react";
import { ChevronLeftIcon } from "../icons/ChevronLeftIcon";
import { ChevronRightIcon } from "../icons/ChevronRightIcon";
import { LogoutIcon } from "../icons/LogoutIcon";
import { UserIcon } from "../icons/UserIcon";
import { SunIcon } from "../icons/SunIcon";
import { MoonIcon } from "../icons/MoonIcon";
import { UsersIcon } from "../icons/UsersIcon";
import { SettingsIcon } from "../icons/SettingsIcon";
import { KeyPermissionsIcon } from "../icons/KeyPermissionsIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { ClipboardListIcon } from "../icons/ClipboardListIcon";
import { UserPlusIcon } from "../icons/UserPlusIcon";
import { SuggestionIcon } from "../icons/SuggestionIcon";
import { useModals } from "../../contexts/ModalContext";
import { HelpCircleIcon } from "../icons/HelpCircleIcon";
import { BugIcon } from "../icons/BugIcon";
import { MessageSquareQuestionIcon } from "../icons/MessageSquareQuestionIcon";
import { BookTextIcon } from "../icons/BookTextIcon";
import { InfoIcon } from "../icons/InfoIcon";
import { GitBranchIcon } from "../icons/GitBranchIcon";
import { CloudArrowUpIcon } from "../icons/CloudArrowUpIcon";

import { StoreIcon } from "../icons/StoreIcon";
import { BookOpenIcon } from "../icons/BookOpenIcon";
import { TagIcon } from "../icons/TagIcon";
import { useEcosystem } from "../../contexts/EcosystemContext";
import { MoveLeft } from "lucide-react";
import { useCapability } from "../../hooks/useCapability";
import { useFinOpsDiagnosticsAccess } from "../../hooks/useFinOpsDiagnosticsAccess";
import { navigationRegistry } from "./navigationRegistry";

// Icons for Theme Customizer

const PaintBrushIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18.375 2.625a3.875 3.875 0 0 0-5.48 0l-9.563 9.563a1.875 1.875 0 0 0 0 2.652l.928.928a1.875 1.875 0 0 0 2.652 0l9.563-9.564a3.875 3.875 0 0 0 0-5.479v0Z"></path>
    <path d="M14.25 7.125 16.875 9.75"></path>
    <path d="M4.5 16.875v1.688a1.688 1.688 0 0 0 1.688 1.688h1.687"></path>
    <path d="M10.5 20.25h.01"></path>
    <path d="M13.5 20.25h.01"></path>
    <path d="M16.5 20.25h.01"></path>
    <path d="M19.5 20.25h.01"></path>
  </svg>
);

const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
    <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
  </svg>
);

interface SidebarContentProps {
  isCollapsed: boolean;
}

const NavItem: React.FC<{
  link: { to: string; text: string; icon: React.ReactNode };
  isCollapsed: boolean;
}> = ({ link, isCollapsed }) => {
  const { openWhatsNew } = useModals();

  const handleClick = (e: React.MouseEvent) => {
    if (link.to === "action:whatsnew") {
      e.preventDefault();
      openWhatsNew();
    }
  };

  return (
  <NavLink
    to={link.to.startsWith("action:") ? "#" : link.to}
    onClick={handleClick}
    end={link.to === "/"}
    className={({ isActive }) =>
      `flex items-center py-2 px-3 mb-1 text-[13px] font-medium rounded-[10px] transition-all duration-300 relative overflow-hidden touch-manipulation cursor-pointer ${
        isCollapsed ? "justify-center w-10 h-10 mx-auto" : ""
      } ${
        isActive && !link.to.startsWith("action:")
          ? "bg-white/[0.06] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)] border border-white/[0.04] font-semibold"
          : "text-slate-400 md:hover:bg-white/[0.04] md:hover:text-slate-200 border border-transparent"
      }`
    }
    title={isCollapsed ? link.text : undefined}
  >
    {({ isActive }) => {
      const isReallyActive = isActive && !link.to.startsWith("action:");
      return (
      <>
        {isReallyActive && !isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary dark:bg-white/30 rounded-r-full pointer-events-none"></div>}
        <span
          className={`flex-shrink-0 transition-transform duration-300 pointer-events-none ${isReallyActive ? "text-primary dark:text-white drop-shadow-sm" : ""}`}
        >
          {React.cloneElement(link.icon as React.ReactElement, {
            className: "w-[18px] h-[18px]",
          })}
        </span>
        {!isCollapsed && (
          <span className="ml-3 whitespace-nowrap pointer-events-none">{link.text}</span>
        )}
      </>
    )}}
  </NavLink>
)};

const SubNavItem: React.FC<{
  link: { to: string; text: string; icon: React.ReactNode; badge?: React.ReactNode };
  onLinkClick?: () => void;
}> = ({ link, onLinkClick }) => {
  const { openSuggestionForm, openHelpModal, openSupportModal, openFeedback, openWhatsNew } = useModals();

  const handleClick = (e: React.MouseEvent) => {
    if (link.to === "indicate") {
      e.preventDefault();
      openSuggestionForm();
      if (onLinkClick) onLinkClick();
    } else if (link.to === "action:feedback") {
      e.preventDefault();
      openFeedback('feedback');
      if (onLinkClick) onLinkClick();
    } else if (link.to === "action:support") {
      e.preventDefault();
      openSupportModal();
      if (onLinkClick) onLinkClick();
    } else if (link.to === "action:whatsnew") {
      e.preventDefault();
      openWhatsNew();
      if (onLinkClick) onLinkClick();
    } else if (link.to.startsWith("action:")) {
      e.preventDefault();
      const section = link.to.split(":")[1];
      openHelpModal(section);
      if (onLinkClick) onLinkClick();
    } else if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <NavLink
      to={link.to.startsWith("action:") ? "#" : link.to}
      onClick={handleClick}
      className={({ isActive }) =>
        `flex items-center py-2 px-3 pl-10 text-[13px] font-medium rounded-[10px] transition-all duration-300 relative my-0.5 overflow-hidden touch-manipulation cursor-pointer ${
          isActive && !link.to.startsWith("action:") && link.to !== "indicate"
            ? "text-white bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.1)] border border-white/[0.04] font-semibold"
            : "text-slate-400 md:hover:bg-white/[0.04] md:hover:text-slate-200 border border-transparent"
        }`
      }
    >
      {({ isActive }) => {
        const isReallyActive =
          isActive && !link.to.startsWith("action:") && link.to !== "indicate";
        return (
          <>
            {isReallyActive && <div className="absolute left-8 top-1/2 -translate-y-1/2 w-1 h-1 bg-primary dark:bg-white/40 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.5)]"></div>}
            <div className="flex items-center flex-1 min-w-0">
               <span
                 className={`w-4 h-4 flex-shrink-0 mr-2 transition-transform duration-300 pointer-events-none ${isReallyActive ? "text-primary dark:text-white drop-shadow-sm" : "opacity-70"}`}
               >
                 {link.icon}
               </span>
               <span className="whitespace-nowrap pointer-events-none truncate mr-2">{link.text}</span>
            </div>
            {link.badge && <span className="flex-shrink-0">{link.badge}</span>}
          </>
        );
      }}
    </NavLink>
  );
};

const CollapsibleNavItem: React.FC<{
  link: { text: string; icon: React.ReactNode; children: any[] };
  isCollapsed: boolean;
}> = ({ link, isCollapsed }) => {
  const location = useLocation();
  const isParentActive = link.children.some((child) => {
    const [path, hash] = child.to.split('#');
    const matchesPath = location.pathname.startsWith(path) && path.startsWith('/');
    const matchesHash = !hash || location.hash === '#' + hash;
    return matchesPath && matchesHash;
  });
  const [isOpen, setIsOpen] = useState(isParentActive);
  const { openSuggestionForm, openHelpModal, openSupportModal, openFeedback } = useModals();

  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setPopoverOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isPopoverOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPopoverOpen]);

  useEffect(() => {
    if (isPopoverOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPopoverPos({ top: rect.top, left: rect.right + 12 });
    }
  }, [isPopoverOpen, isCollapsed]);

  useEffect(() => {
    setIsOpen(isParentActive);
  }, [isParentActive]);

  const handleChildClick = (to: string) => {
    setPopoverOpen(false);
    if (to === "indicate") {
      openSuggestionForm();
    } else if (to === "action:feedback") {
      openFeedback('feedback');
    } else if (to === "action:support") {
      openSupportModal();
    } else if (to.startsWith("action:")) {
      const section = to.split(":")[1];
      openHelpModal(section);
    }
  };

  if (isCollapsed) {
    return (
      <>
        <button
          ref={triggerRef}
          onClick={() => setPopoverOpen((prev) => !prev)}
          className={`flex items-center justify-center w-[42px] h-[42px] mx-auto my-1 rounded-[14px] transition-all duration-200 group relative ${
            isParentActive
              ? "bg-white dark:bg-white/10 text-primary dark:text-white border border-black/[0.04] dark:border-transparent shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] dark:shadow-none"
              : "text-slate-500 dark:text-slate-400 hover:bg-black/[0.02] dark:hover:bg-white/5 active:scale-95"
          }`}
          title={link.text}
        >
          {React.cloneElement(link.icon as React.ReactElement, {
            className: "w-5 h-5 drop-shadow-sm pointer-events-none",
          })}
        </button>
        {isPopoverOpen && ReactDOM.createPortal(
          <div 
             ref={popoverRef}
             style={{ top: popoverPos.top, left: popoverPos.left }}
             className="fixed w-56 bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_20px_40px_-8px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.5)] p-2 z-[9999] animate-scale-in"
          >
            <p className="px-3 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-black/[0.03] dark:border-white/[0.04] mb-2">
              {link.text}
            </p>
            {link.children.map((child) => (
              <NavLink
                key={child.to}
                to={
                  child.to.startsWith("action:") || child.to === "indicate"
                    ? location.pathname
                    : child.to
                }
                onClick={() => handleChildClick(child.to)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${isActive && !child.to.startsWith("action:") && child.to !== "indicate" ? "bg-black/[0.03] dark:bg-white/[0.06] text-black dark:text-white font-semibold" : "text-slate-600 dark:text-[#888888] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:text-slate-900 dark:hover:text-white"}`
                }
              >
                {React.cloneElement(child.icon, { className: "w-4 h-4" })}
                {child.text}
              </NavLink>
            ))}
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between py-2 px-3 mb-1 text-[13px] font-medium rounded-[10px] transition-all duration-300 overflow-hidden touch-manipulation cursor-pointer ${
          isParentActive
            ? "text-white bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] border border-white/[0.02] font-semibold"
            : "text-slate-400 md:hover:bg-white/[0.04] md:hover:text-slate-200 border border-transparent"
        }`}
      >
        <div className="flex items-center pointer-events-none">
          <span
            className={`flex-shrink-0 transition-transform duration-300 ${isOpen ? "text-primary dark:text-white drop-shadow-sm" : ""}`}
          >
            {React.cloneElement(link.icon as React.ReactElement, {
              className: "w-[18px] h-[18px]",
            })}
          </span>
          <span className="ml-3 whitespace-nowrap">{link.text}</span>
        </div>
        <ChevronRightIcon
          className={`w-3.5 h-3.5 transition-transform duration-300 pointer-events-none ${isOpen ? "rotate-90 text-primary dark:text-white" : "text-slate-400"}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="pt-0.5 pb-2">
            {link.children.map((child) => (
              <SubNavItem key={child.to} link={child} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SidebarContent: React.FC<SidebarContentProps> = ({ isCollapsed }) => {
  const { user, userProfile, organization, permissions, isAdmin, isCurationAdmin } = useAuth();
  const { navigateToEcosystem, isDegraded } = useEcosystem();
  const { t } = useTranslation();
  const { hasCapability } = useCapability();
  const navigate = useNavigate();
  const { allowed: finopsAllowed, loading: finopsLoading } = useFinOpsDiagnosticsAccess();
  
  // TODO: Implement actual pending join requests count if needed. Setting to 0 for now to prevent undefined errors.
  const pendingJoinRequests = 0;

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      logger.error("Error signing out: ", error);
    }
  };

  const isCurationAllowed = (id: string) => {
    if (id === "curation_queue") return isCurationAdmin;
    return true;
  };

  const sections = (["primary", "admin", "help"] as const).map((sectionKey) => {
    const items = navigationRegistry.filter((item) => item.section === sectionKey && item.group === null);
    
    const visibleItems = items
      .map((item) => {
        if (!isCurationAllowed(item.id)) return null;

        // Custom FinOps Diagnostics Logic
        if (item.id === "finops_diagnostics") {
           if (!finopsAllowed || finopsLoading) return null;
        } else {
           const isAllowed = !item.permissionRequired || hasCapability(item.permissionRequired);
           if (!isAllowed) return null;
        }

        if (item.type === "group_trigger") {
          const children = navigationRegistry.filter((c) => c.group === item.id);
          const visibleChildren = children.filter((child) => {
             if (child.id === "finops_diagnostics") {
                 return finopsAllowed && !finopsLoading;
             }
             return !child.permissionRequired || hasCapability(child.permissionRequired)
          });
          
          if (visibleChildren.length === 0) return null;

          if (visibleChildren.length === 1 && item.collapseToDirectWhenSingleChild) {
            const child = visibleChildren[0];
            return {
              id: item.id,
              type: "link" as const,
              to: child.path || "",
              text: t(child.labelKey, child.defaultLabel),
              icon: item.icon, // Use parent's icon
            };
          }

          return {
            id: item.id,
            type: "group" as const,
            text: t(item.labelKey, item.defaultLabel),
            icon: item.icon,
            children: visibleChildren.map((child) => ({
              to: child.path || "",
              text: t(child.labelKey, child.defaultLabel),
              icon: child.icon,
              // Badge support
              badge: child.id === "members" && pendingJoinRequests > 0 ? (
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
              ) : undefined
            })),
          };
        } else {
          return {
            id: item.id,
            type: "link" as const,
            to: item.path || "",
            text: t(item.labelKey, item.defaultLabel),
            icon: item.icon,
            badge: item.id === "members" && pendingJoinRequests > 0 ? (
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
            ) : undefined
          };
        }
      })
      .filter(Boolean) as any[];

    return {
      key: sectionKey,
      label: sectionKey === "primary" 
        ? t("nav.section_primary", "Principal") 
        : sectionKey === "admin" 
          ? t("nav.section_admin", "Administração") 
          : t("nav.help", "Ajuda"),
      items: visibleItems,
    };
  }).filter(section => section.items.length > 0);

  const photoURL = userProfile?.photoURL || user?.photoURL;
  const displayName =
    userProfile?.displayName || user?.displayName || t("nav.account", "Conta");

  return (
    <div
      className={`flex flex-col flex-shrink-0 h-full bg-[#0a0a0c]/80 backdrop-blur-[32px] saturate-[180%] supports-[backdrop-filter]:bg-[#0a0a0c]/60 border border-white/[0.06] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)] rounded-[20px] overflow-hidden transition-[width] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-[90] ${isCollapsed ? "w-20" : "w-64"}`}
    >
      <div className="relative z-10 flex flex-col h-full w-full">      
      {/* Ecosystem Back Navigation */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-2 px-3 py-1.5 w-full rounded-xl bg-slate-900/5 dark:bg-white/5 hover:bg-slate-900/10 dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-slate-300 font-medium ${isCollapsed ? "justify-center" : ""}`}
          title={isCollapsed ? t("nav.back", "Voltar") : undefined}
        >
          <MoveLeft className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-[12px] truncate">{t("nav.back", "Voltar")}</span>}
        </button>
      </div>

      {/* Header Logo - Perfectly Centered */}
      <div className="h-[72px] flex items-center justify-center relative flex-shrink-0 mb-2">
        <div
          className={`flex items-center gap-3 transition-all duration-300 ${isCollapsed ? "justify-center" : "px-5 w-full"}`}
        >
          <div
            className={`flex-shrink-0 flex items-center justify-center transition-all duration-300 ${isCollapsed ? "w-[42px] h-[42px]" : "w-7 h-7"}`}
          >
            <img 
              src="/LogoIcon.png" 
              alt="MusicScale Logo" 
              className="w-full h-full object-contain drop-shadow-sm"
            />
          </div>
          <div
            className={`flex flex-col justify-center overflow-hidden transition-all duration-300 ${isCollapsed ? "w-0 opacity-0" : "flex-1 min-w-0 opacity-100"}`}
          >
            <span className="text-[15px] font-bold text-slate-900 dark:text-white tracking-tight leading-none truncate">
              MusicScale
            </span>
            <span className="text-[9px] font-bold text-primary uppercase tracking-widest truncate mt-1">
              {organization?.name ||
                (userProfile?.organizationId
                  ? t("nav.loading", "Carregando...")
                  : t("nav.no_organization", "Sem Organização"))}
            </span>
          </div>
        </div>
      </div>

      <nav
        className={`flex-1 py-4 space-y-4 ${isCollapsed ? "px-2 overflow-visible" : "px-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"}`}
      >
        {sections.map((section, sectionIdx) => (
          <div key={section.key} className="space-y-1">
            {sectionIdx > 0 && <div className="h-[1px] bg-white/[0.04] my-3 mx-2" />}
            {!isCollapsed && (
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] px-3 pt-2 pb-1 select-none">
                {section.label}
              </div>
            )}
            {section.items.map((item) => (
              <div key={item.id} className="mb-1">
                {item.type === "group" ? (
                  <CollapsibleNavItem link={item} isCollapsed={isCollapsed} />
                ) : (
                  <NavItem link={item} isCollapsed={isCollapsed} />
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div
        className={`mt-auto bg-transparent flex-shrink-0 pb-4 ${isCollapsed ? "p-2" : "px-4"}`}
      >
        {isDegraded && (
          <div className={`mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex flex-col gap-1 ${isCollapsed ? "items-center justify-center w-10 h-10 mx-auto" : ""}`} title={t("nav.degraded_title", "Algumas opções estão temporariamente indisponíveis.")}>
            {isCollapsed ? (
              <span className="relative flex h-2 w-2">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            ) : (
              <>
                <div className="flex items-center gap-2 font-semibold text-[11px] uppercase tracking-wider">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                  <span>{user ? t("nav.degraded_warning", "Atenção") : "Sessão Local"}</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  {t("nav.degraded_title", "Algumas opções estão temporariamente indisponíveis.")}
                </p>
                <div className="mt-1 flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:underline text-left cursor-pointer"
                  >
                    {t("nav.degraded_retry", "Tentar novamente")}
                  </button>
                  {hasCapability('manageOrganization') && (
                    <Link
                      to="/debug/session"
                      className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 hover:underline text-left cursor-pointer"
                    >
                      {t("nav.degraded_details", "Ver detalhes")}
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <LanguageSelector isCollapsed={isCollapsed} />

        <div
          className={`mt-2 flex flex-col gap-1 ${isCollapsed ? "items-center" : ""}`}
        >
          <NavLink
            to="/profile"
            className={`flex items-center gap-3 p-2.5 rounded-[12px] transition-all duration-300 group ${isCollapsed ? "justify-center w-10 h-10 mx-auto" : "hover:bg-white/[0.04]"}`}
            title={isCollapsed ? t("nav.my_profile", "Meu Perfil") : undefined}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 p-[1px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] overflow-hidden transition-transform group-hover:scale-105 duration-300">
              <div className="w-full h-full rounded-full bg-[#111111] flex items-center justify-center overflow-hidden">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="User"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                )}
              </div>
            </div>
            <div
              className={`flex-1 min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"}`}
            >
              <p className="font-semibold text-sm text-slate-900 dark:text-white truncate tracking-tight">
                {displayName}
              </p>
              {(() => {
                const displayRole = getPrimaryDisplayRole(userProfile, organization);
                const isPremiumSys = displayRole.scope === 'ecosystem';
                const rawPlanName = organization?.plan || organization?.subscriptionPlan || 'Starter';
                const planName = rawPlanName;

                let primaryColor = "text-primary dark:text-primary-light";
                let displayLabel = displayRole.label;
                
                if (isPremiumSys) {
                    primaryColor = "text-[#FFD700] drop-shadow-[0_0_2px_rgba(255,215,0,0.5)]";
                } else if (displayRole.badgeVariant === 'organizationOwner') {
                    primaryColor = "text-[#A855F7] dark:text-[#C084FC]";
                }

                let secondaryBadge = null;
                if (isPremiumSys) {
                    // Show local role as secondary if it is something other than 'Membro'
                    const localRoleStr = (userProfile?.organizationRole || userProfile?.role || 'membro').toLowerCase();
                    if (!localRoleStr.includes('membro') && !localRoleStr.includes('musician')) {
                         const localDisplay = getPrimaryDisplayRole({ ...userProfile, systemRole: null }, organization);
                         secondaryBadge = localDisplay.label;
                    }
                }
                
                if (!secondaryBadge) {
                   secondaryBadge = planName.charAt(0).toUpperCase() + planName.slice(1);
                }

                return (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <p className={`text-[11px] font-bold ${primaryColor} truncate block`} style={{letterSpacing: "0.02em"}}>
                      {displayLabel}
                    </p>
                    {secondaryBadge && (
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate opacity-90">
                        {secondaryBadge}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 p-2.5 rounded-[12px] text-[13px] font-semibold text-red-500/90 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 group active:scale-[0.98] ${isCollapsed ? "justify-center w-10 h-10 mx-auto" : "w-full"}`}
            title={t("nav.logout_short", "Sair")}
          >
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-[10px] bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
              <LogoutIcon className="w-4 h-4 ml-0.5" />
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"}`}
            >
              {t("nav.logout", "Sair da Conta")}
            </div>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`relative z-[90] h-full transition-all duration-300 ease-in-out pointer-events-auto ${isCollapsed ? "w-20" : "w-64"}`}
    >
      <SidebarContent isCollapsed={isCollapsed} />

      <button
        onClick={onToggle}
        className="absolute top-10 -right-3 z-[100] bg-[#18181b]/90 hover:bg-[#27272a]/95 backdrop-blur-md border border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.5)] rounded-full w-[26px] h-[26px] flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none"
        aria-label={isCollapsed ? t("nav.expand_menu", "Expandir menu") : t("nav.collapse_menu", "Recolher menu")}
      >
        {isCollapsed ? (
          <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300" />
        ) : (
          <ChevronLeftIcon className="w-3.5 h-3.5 text-slate-300" />
        )}
      </button>
    </div>
  );
};

export default Sidebar;
