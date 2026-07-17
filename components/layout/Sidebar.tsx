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
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';

const resolveNavigationAction = (actionPath: string, modals: any, onResolved?: () => void) => {
  if (actionPath === "action:indicate") {
    modals.openSuggestionForm();
    if (onResolved) onResolved();
    return true;
  }
  if (actionPath === "action:feedback") {
    modals.openFeedback('feedback');
    if (onResolved) onResolved();
    return true;
  }
  if (actionPath === "action:faq") {
    modals.openHelpModal("faq");
    if (onResolved) onResolved();
    return true;
  }
  if (actionPath === "action:whatsnew") {
    modals.openWhatsNew();
    if (onResolved) onResolved();
    return true;
  }
  if (actionPath.startsWith("action:")) {
    const section = actionPath.split(":")[1];
    modals.openHelpModal(section);
    if (onResolved) onResolved();
    return true;
  }
  return false;
};

interface SidebarContentProps {
  isCollapsed: boolean;
  onLinkClick?: () => void;
}

const NavItem: React.FC<{
  link: { to: string; text: string; icon: React.ReactNode; badge?: React.ReactNode };
  isCollapsed: boolean;
  onLinkClick?: () => void;
}> = ({ link, isCollapsed, onLinkClick }) => {
  const modals = useModals();

  const handleClick = (e: React.MouseEvent) => {
    if (link.to.startsWith("action:")) {
      e.preventDefault();
      resolveNavigationAction(link.to, modals, onLinkClick);
    } else if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
  <NavLink
    to={link.to.startsWith("action:") ? "#" : link.to}
    onClick={handleClick}
    end={link.to === "/"}
    className={({ isActive }) =>
        `flex items-center py-[10px] px-3 mb-1 text-[14px] rounded-[12px] transition-all duration-200 relative touch-manipulation cursor-pointer group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-[#07080A] ${
          isCollapsed ? "justify-center w-11 h-11 mx-auto" : "justify-start gap-3"
        } ${
          isActive && !link.to.startsWith("action:")
            ? "bg-white/[0.07] text-white border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-semibold"
            : "text-slate-300 hover:bg-white/[0.03] hover:text-slate-100 border border-transparent font-medium"
        }`
      }
    title={isCollapsed ? link.text : undefined}
  >
    {({ isActive }) => {
      const isReallyActive = isActive && !link.to.startsWith("action:");
      return (
      <>
        {isReallyActive && !isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[20px] bg-gradient-to-b from-indigo-400 to-violet-500 rounded-r-full pointer-events-none"></div>}
        <span
          className={`flex-shrink-0 transition-transform duration-200 pointer-events-none ${isReallyActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}
        >
          {React.cloneElement(link.icon as React.ReactElement, {
            className: "w-[18px] h-[18px]",
          })}
        </span>
        {!isCollapsed && (
          <span className="whitespace-nowrap pointer-events-none flex-1 truncate">{link.text}</span>
        )}
        {!isCollapsed && link.badge && <span className="flex-shrink-0 ml-2">{link.badge}</span>}
        {isCollapsed && link.badge && <span className="absolute top-1.5 right-1.5">{link.badge}</span>}
      </>
    )}}
  </NavLink>
)};

const SubNavItem: React.FC<{
  link: { to: string; text: string; icon: React.ReactNode; badge?: React.ReactNode };
  onLinkClick?: () => void;
}> = ({ link, onLinkClick }) => {
  const modals = useModals();

  const handleClick = (e: React.MouseEvent) => {
    if (link.to.startsWith("action:")) {
      e.preventDefault();
      resolveNavigationAction(link.to, modals, onLinkClick);
    } else if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <NavLink
      to={link.to.startsWith("action:") ? "#" : link.to}
      onClick={handleClick}
      role="menuitem"
      className={({ isActive }) =>
        `flex items-center py-2 px-3 pl-[42px] mb-0.5 text-[13.5px] rounded-[10px] transition-all duration-200 relative touch-manipulation cursor-pointer group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isActive && !link.to.startsWith("action:")
            ? "bg-white/[0.07] text-white border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-semibold"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent font-medium"
        }`
      }
    >
      {({ isActive }) => {
        const isReallyActive =
          isActive && !link.to.startsWith("action:");
        return (
          <>
            {isReallyActive && <div className="absolute left-[24px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] bg-indigo-400 rounded-full"></div>}
            <div className="flex items-center gap-3 flex-1 min-w-0">
               <span
                 className={`flex-shrink-0 transition-transform duration-200 pointer-events-none ${isReallyActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}
               >
                 {React.cloneElement(link.icon as React.ReactElement, { className: "w-4 h-4" })}
               </span>
               <span className="whitespace-nowrap pointer-events-none truncate">{link.text}</span>
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
  onLinkClick?: () => void;
}> = ({ link, isCollapsed, onLinkClick }) => {
  const location = useLocation();
  const isParentActive = link.children.some((child) => {
    const [path, hash] = child.to.split('#');
    const matchesPath = location.pathname.startsWith(path) && path.startsWith('/');
    const matchesHash = !hash || location.hash === '#' + hash;
    return matchesPath && matchesHash;
  });
  const [isOpen, setIsOpen] = useState(isParentActive);
  
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 0 });

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
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };
    
    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPopoverOpen]);

  const togglePopover = (e: React.MouseEvent) => {
    if (isCollapsed) {
      if (!isPopoverOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const margin = 20;
        const availableHeight = window.innerHeight - margin * 2;
        
        let expectedTop = rect.top;
        const estimatedHeight = Math.min(link.children.length * 40 + 40, availableHeight);
        if (expectedTop + estimatedHeight > window.innerHeight - margin) {
            expectedTop = window.innerHeight - margin - estimatedHeight;
        }
        if (expectedTop < margin) expectedTop = margin;

        let expectedLeft = rect.right + 10;
        if (expectedLeft + 220 > window.innerWidth) { 
            expectedLeft = rect.left - 220 - 10;
        }

        setPopoverPos({ 
            top: expectedTop, 
            left: expectedLeft,
            width: 220,
            maxHeight: availableHeight
        });
      }
      setPopoverOpen(!isPopoverOpen);
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="mb-1">
      <button
        ref={triggerRef}
        onClick={togglePopover}
        className={`w-full flex items-center py-[10px] px-3 text-[14px] rounded-[12px] transition-all duration-200 relative touch-manipulation group outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-[#07080A] ${
          isCollapsed ? "justify-center w-11 h-11 mx-auto" : "justify-start gap-3"
        } ${
          isParentActive
            ? "text-slate-100 font-semibold"
            : "text-slate-300 hover:bg-white/[0.03] hover:text-slate-100 font-medium border border-transparent"
        }`}
        title={isCollapsed ? link.text : undefined}
        aria-expanded={isCollapsed ? isPopoverOpen : isOpen}
        aria-haspopup="menu"
        aria-controls={`menu-${link.text.replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-3 pointer-events-none flex-1 min-w-0">
          <span
            className={`flex-shrink-0 transition-transform duration-200 ${
              isParentActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
            }`}
          >
            {React.cloneElement(link.icon as React.ReactElement, {
              className: "w-[18px] h-[18px]",
            })}
          </span>
          {!isCollapsed && <span className="truncate flex-1 text-left">{link.text}</span>}
        </div>
        {!isCollapsed && (
          <ChevronRightIcon
            className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 pointer-events-none text-slate-500 ${
              isOpen ? "rotate-90 text-slate-300" : ""
            }`}
          />
        )}
      </button>

      {/* Accordion for uncollapsed/mobile */}
      {!isCollapsed && (
        <div
          id={`menu-${link.text.replace(/\s+/g, '-')}`}
          role="menu"
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0"
          }`}
        >
          {link.children.map((child, idx) => (
            <SubNavItem key={idx} link={child} onLinkClick={onLinkClick} />
          ))}
        </div>
      )}

      {/* Popover for collapsed */}
      {isCollapsed && isPopoverOpen && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          role="menu"
          className="fixed z-[1000] min-w-[200px] bg-[#07080A]/95 backdrop-blur-[28px] border border-white/[0.08] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] rounded-[16px] overflow-hidden"
          style={{
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            maxHeight: `${popoverPos.maxHeight}px`,
          }}
        >
          <div className="px-3 pt-3 pb-2 border-b border-white/[0.05] mb-1 sticky top-0 bg-[#07080A]/95 backdrop-blur-md z-10">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{link.text}</h4>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5">
            {link.children.map((child, idx) => (
              <SubNavItem key={idx} link={child} onLinkClick={() => {
                  setPopoverOpen(false);
                  if (onLinkClick) onLinkClick();
              }} />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const SidebarContent: React.FC<SidebarContentProps> = ({ isCollapsed, onLinkClick }) => {
  const { user, userProfile, organization, effectiveOrganizationName, isAdmin, isCurationAdmin } = useAuth();
  const { navigateToEcosystem, isDegraded } = useEcosystem();
  const { t } = useTranslation();
  const { hasCapability } = useCapability();
  const { allowed: finopsAllowed, loading: finopsLoading } = useFinOpsDiagnosticsAccess();
  
  const [pendingJoinRequests, setPendingJoinRequests] = useState(0);

  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!userProfile?.organizationId || !hasCapability('manageMembers')) {
          setPendingJoinRequests(0);
          return;
      }
      try {
        const q = query(
          collection(db, 'organization_join_requests'), 
          where('organizationId', '==', userProfile.organizationId),
          where('status', '==', 'pending'),
          limit(1)
        );
        const snap = await getDocs(q);
        setPendingJoinRequests(snap.empty ? 0 : 1);
      } catch (e) {
        logger.error("Failed to load join requests in Sidebar", e);
      }
    };
    fetchPendingRequests();
  }, [userProfile?.organizationId, hasCapability]);

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      logger.error("Error signing out: ", error);
    }
  };

  const isCurationAllowed = (id: string) => {
    if (id === "curation_queue") {
        return isCurationAdmin || hasCapability("musicscale.songs.edit") || hasCapability("manageOrganization");
    }
    return true;
  };

  const sections = (["primary", "admin", "help"] as const).map((sectionKey) => {
    const items = navigationRegistry.filter((item) => item.section === sectionKey && item.group === null);
    
    const visibleItems = items
      .map((item) => {
        if (!isCurationAllowed(item.id)) return null;

        if (item.id === "finops_diagnostics") {
           if (!finopsAllowed || finopsLoading) return null;
        } else {
           const isAllowed = !item.permissionRequired || hasCapability(item.permissionRequired);
           if (!isAllowed) return null;
        }

        if (item.type === "group_trigger") {
          const children = navigationRegistry.filter((c) => c.group === item.id);
          const visibleChildren = children.filter((child) => {
             if (!isCurationAllowed(child.id)) return false;
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
              icon: item.icon, 
            };
          }

          return {
            id: item.id,
            type: "group" as const,
            text: t(item.labelKey, item.defaultLabel),
            icon: item.icon,
            children: visibleChildren.map((child) => ({
              id: child.id,
              to: child.path || "",
              text: t(child.labelKey, child.defaultLabel),
              icon: child.icon,
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
      
    return { id: sectionKey, items: visibleItems };
  });

  const photoURL = userProfile?.photoURL || user?.photoURL;
  const displayName = userProfile?.displayName || user?.displayName || "Usuário";

  return (
    <div className="h-full flex flex-col bg-[#07080A]/95 backdrop-blur-[28px] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.03)] pt-3 md:pt-4 relative overflow-hidden rounded-[24px] md:rounded-none ring-1 ring-inset ring-white/[0.02]">
      
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-50 mix-blend-screen"></div>
      <div className="absolute -top-[200px] -left-[200px] w-[400px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-40 mix-blend-screen"></div>
      <div className="absolute -bottom-[200px] -right-[200px] w-[400px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none opacity-30 mix-blend-screen"></div>

      <div className={`flex flex-col px-4 mb-6 relative z-10 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${isCollapsed ? "items-center" : "items-stretch"}`}>
        <button
          onClick={navigateToEcosystem}
          className={`group flex items-center justify-center h-10 rounded-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.985] ${isCollapsed ? "w-10 px-0" : "w-full px-4 mb-6"}`}
          title={t("nav.back_to_ecosystem", "Voltar")}
        >
          <MoveLeft className={`w-4 h-4 text-slate-300 group-hover:text-white transition-colors ${!isCollapsed && "mr-2"}`} />
          {!isCollapsed && <span className="text-[13px] font-medium text-slate-300 group-hover:text-white transition-colors">{t("nav.back_to_ecosystem", "Voltar")}</span>}
        </button>

        {!isCollapsed && (
          <div className="flex flex-col items-center text-center px-2">
             <div className="w-[42px] h-[42px] rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-3 shadow-[0_8px_16px_-6px_rgba(99,102,241,0.4)] border border-white/[0.12]">
                <MusicNoteIcon className="w-5 h-5 text-white" />
             </div>
             <h2 className="text-[15px] font-bold text-white tracking-tight leading-tight">MusicScale</h2>
             {organization && (
               <p className="text-[12px] font-medium text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)] truncate w-full max-w-full mt-1">
                 {effectiveOrganizationName || organization.name}
               </p>
             )}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <nav className="flex-1 px-3 space-y-1 relative z-10">
          {sections.map((section, idx) => (
            section.items.length > 0 && (
              <div key={section.id} className={`${section.id === "primary" ? "mb-6" : section.id === "admin" ? "mb-4" : ""}`}>
                {section.id === "help" && <div className="border-t border-white/[0.06] mt-4 mb-4 mx-2"></div>}
                {!isCollapsed && section.id !== "primary" && section.id !== "help" && (
                  <h3 className="px-3 mt-6 mb-2 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    {t(`nav.section_${section.id}`)}
                  </h3>
                )}
                {section.items.map((item) =>
                  item.type === "group" ? (
                    <CollapsibleNavItem key={item.id} link={item} isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
                  ) : (
                    <NavItem key={item.id} link={item} isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
                  )
                )}
              </div>
            )
          ))}
        </nav>

        <div
          className={`mt-auto bg-transparent flex-shrink-0 pb-6 pt-4 ${isCollapsed ? "px-2" : "px-4"}`}
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
                    <span>{user ? t("nav.degraded_warning", "Atenção") : t("nav.local_session", "Sessão Local")}</span>
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
              onClick={onLinkClick}
              className={`flex items-center gap-3 p-2.5 rounded-[12px] transition-all duration-200 group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary ${isCollapsed ? "justify-center w-11 h-11 mx-auto" : "hover:bg-white/[0.03]"}`}
              title={isCollapsed ? t("nav.my_profile", "Meu Perfil") : undefined}
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-white/5 p-[1px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] overflow-hidden transition-transform group-hover:scale-105 duration-200">
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
                <p className="font-semibold text-[13px] text-white truncate tracking-tight">
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
                      primaryColor = "text-amber-400/90";
                  } else if (displayRole.badgeVariant === 'organizationOwner') {
                      primaryColor = "text-purple-400";
                  }

                  let secondaryBadge = null;
                  if (isPremiumSys) {
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
              className={`flex items-center gap-3 p-2.5 rounded-[12px] text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${isCollapsed ? "justify-center w-11 h-11 mx-auto" : "w-full"}`}
              title={t("nav.logout_short", "Sair")}
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-[10px] bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                <LogoutIcon className="w-4 h-4 ml-0.5 text-red-400 group-hover:text-red-300 transition-colors" />
              </div>
              <div
                className={`overflow-hidden transition-all duration-300 whitespace-nowrap text-left ${isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"}`}
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
  onLinkClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, onLinkClick }) => {
  const { t } = useTranslation();

  return (
    <div
      className={`relative z-[90] h-full transition-all duration-300 ease-in-out pointer-events-auto ${isCollapsed ? "w-20" : "w-[min(88vw,304px)] md:w-[256px]"}`}
    >
      <SidebarContent isCollapsed={isCollapsed} onLinkClick={onLinkClick} />
      <button
        onClick={onToggle}
        className="absolute top-10 -right-3 z-[100] bg-[#18181b]/90 hover:bg-[#27272a]/95 backdrop-blur-md border border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.5)] rounded-full w-[26px] h-[26px] hidden md:flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none"
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
