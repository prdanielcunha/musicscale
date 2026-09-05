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
        {isReallyActive && !isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-white/40 rounded-r-full pointer-events-none"></div>}
        <span
          className={`flex-shrink-0 transition-transform duration-300 pointer-events-none ${isReallyActive ? "text-white drop-shadow-sm" : ""}`}
        >
          {React.cloneElement(link.icon as React.ReactElement, {
            className: "w-[18px] h-[18px]",
          })}
        </span>
        {!isCollapsed && (
          <span className="ml-3 whitespace-nowrap pointer-events-none flex-1 truncate">{link.text}</span>
        )}
        {!isCollapsed && link.badge && <span className="flex-shrink-0 ml-2">{link.badge}</span>}
        {isCollapsed && link.badge && <span className="absolute top-1.5 right-1.5">{link.badge}</span>}
      </>
    )}}
  </NavLink>
)};

const normalizeSubmenuIcon = (icon: React.ReactNode) => {
  if (!React.isValidElement(icon)) return icon;
  
  const existingClassName = icon.props.className || '';
  const normalizedClassName = `${existingClassName} block w-[15px] h-[15px] shrink-0`.trim();
  
  return React.cloneElement(icon as React.ReactElement, {
    className: normalizedClassName
  });
};

const SubNavItem: React.FC<{
  link: { to: string; text: string; icon: React.ReactNode; badge?: React.ReactNode };
  onLinkClick?: () => void;
  variant?: "accordion" | "popover";
}> = ({ link, onLinkClick, variant = "accordion" }) => {
  const modals = useModals();

  const handleClick = (e: React.MouseEvent) => {
    if (link.to.startsWith("action:")) {
      e.preventDefault();
      resolveNavigationAction(link.to, modals, onLinkClick);
    } else if (onLinkClick) {
      onLinkClick();
    }
  };

  const isAccordion = variant === "accordion";

  return (
    <NavLink
      to={link.to.startsWith("action:") ? "#" : link.to}
      onClick={handleClick}
      role="menuitem"
      className={({ isActive }) =>
        `grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2.5 min-h-[36px] py-1.5 pr-3 text-[13px] font-medium rounded-[10px] transition-all duration-300 relative my-0.5 touch-manipulation cursor-pointer ${
          isAccordion ? "pl-[38px]" : "px-3"
        } ${
          isActive && !link.to.startsWith("action:")
            ? "text-white bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.1)] border border-white/[0.04] font-semibold"
            : "text-slate-400 md:hover:bg-white/[0.03] md:hover:text-slate-300 border border-transparent"
        }`
      }
    >
      {({ isActive }) => {
        const isReallyActive =
          isActive && !link.to.startsWith("action:");
        return (
          <>
            {isReallyActive && (
              <div 
                className={`absolute top-1/2 -translate-y-1/2 w-[3px] h-[3px] bg-white/40 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.2)] ${
                  isAccordion ? "left-7" : "left-1.5"
                }`}
              ></div>
            )}
            <div className={`flex justify-center items-center pointer-events-none transition-colors duration-300 ${isReallyActive ? "text-white drop-shadow-sm" : ""}`}>
               {normalizeSubmenuIcon(link.icon)}
            </div>
            <div className="whitespace-nowrap pointer-events-none truncate leading-none md:mt-0.5">
               {link.text}
            </div>
            {link.badge && (
              <div className="flex-shrink-0 flex items-center justify-center">
                {link.badge}
              </div>
            )}
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
        className={`w-full flex items-center py-2 px-3 text-[13px] font-medium rounded-[10px] transition-all duration-300 relative touch-manipulation group ${
          isCollapsed ? "justify-center w-10 h-10 mx-auto" : "justify-between"
        } ${
          isParentActive
            ? "bg-white/[0.04] text-white"
            : "text-slate-400 md:hover:bg-white/[0.04] md:hover:text-slate-200"
        }`}
        title={isCollapsed ? link.text : undefined}
        aria-expanded={isCollapsed ? isPopoverOpen : isOpen}
        aria-haspopup="menu"
        aria-controls={`menu-${link.text.replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center pointer-events-none">
          <span
            className={`flex-shrink-0 transition-transform duration-300 ${
              isParentActive ? "text-white" : ""
            }`}
          >
            {React.cloneElement(link.icon as React.ReactElement, {
              className: "w-[18px] h-[18px]",
            })}
          </span>
          {!isCollapsed && <span className="ml-3 truncate">{link.text}</span>}
        </div>
        {!isCollapsed && (
          <ChevronRightIcon
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-300 pointer-events-none ${
              isOpen ? "rotate-90" : ""
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
            <SubNavItem key={idx} link={child} onLinkClick={onLinkClick} variant="accordion" />
          ))}
        </div>
      )}

      {/* Popover for collapsed */}
      {isCollapsed && isPopoverOpen && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          role="menu"
          className="fixed z-[1000] min-w-[200px] bg-[#0a0a0c]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-y-auto"
          style={{
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            maxHeight: `${popoverPos.maxHeight}px`,
          }}
        >
          <div className="px-3 pt-3 pb-2 border-b border-white/[0.05] mb-1 sticky top-0 bg-[#0a0a0c]/95 backdrop-blur-md z-10">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{link.text}</h4>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5">
            {link.children.map((child, idx) => (
              <SubNavItem key={idx} link={child} onLinkClick={() => {
                  setPopoverOpen(false);
                  if (onLinkClick) onLinkClick();
              }} variant="popover" />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const SidebarContent: React.FC<SidebarContentProps> = ({ isCollapsed, onLinkClick }) => {
  const { user, userProfile, organization, isAdmin, isCurationAdmin } = useAuth();
  const { navigateToEcosystem, isDegraded, context: ecosystemContext } = useEcosystem();
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
          collection(db, 'organizations', userProfile.organizationId, 'join_requests'),
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
    <div 
      className="h-full flex flex-col bg-[#0a0a0c]/[0.985] md:bg-[#0a0a0c]/80 md:backdrop-blur-[32px] md:saturate-[180%] border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)] pt-2 md:pt-4 relative overflow-hidden rounded-[20px] transform-gpu"
    >
      <style>{`
        .sidebar-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 9999px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.20);
        }
      `}</style>
      <div
        className={`flex flex-col px-4 mb-4 relative z-10 transition-all duration-300`}
      >
        <button
          onClick={navigateToEcosystem}
          className={`group flex items-center bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] transition-all duration-300 focus:outline-none mb-6 ${
            isCollapsed ? "justify-center w-[42px] h-[42px] rounded-xl mx-auto" : "px-4 h-[32px] rounded-xl w-full"
          }`}
          title={t("nav.back_to_ecosystem", "Voltar para MillionsNest")}
        >
          <MoveLeft className={`w-4 h-4 text-slate-300 group-hover:text-white transition-colors ${isCollapsed ? "" : "mr-2"}`} />
          {!isCollapsed && <span className="text-[12px] font-medium text-slate-300 group-hover:text-white">Voltar</span>}
        </button>

        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-start"}`}>
          <img src="/LogoIcon.png" alt="MusicScale Logo" className={`flex-shrink-0 ${isCollapsed ? "w-[42px] h-[42px]" : "w-[28px] h-[28px]"}`} />
          {!isCollapsed && (
            <div className="ml-3 flex flex-col">
              <span className="text-[15px] font-bold text-white tracking-tight leading-none mb-1">MusicScale</span>
              <span className="block text-[9px] font-bold uppercase tracking-widest text-primary dark:text-primary-light leading-none truncate max-w-[150px]">
                {organization?.name || "Workspace"}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto flex flex-col sidebar-scrollbar"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.12) transparent'
        }}
      >
        <nav className="flex-1 px-3 space-y-1 relative z-10">
          {sections.map((section, idx) => (
            section.items.length > 0 && (
              <div key={section.id} className={`${section.id === "primary" ? "mb-6" : section.id === "admin" ? "mb-4" : ""}`}>
                {section.id === "help" && <div className="border-t border-white/[0.06] mt-4 mb-4 mx-2"></div>}
                {!isCollapsed && section.id !== "help" && (
                  <h3 className="px-3 mb-2 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">
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
                  const displayRole = getPrimaryDisplayRole(userProfile, organization, ecosystemContext?.ecosystemRole);
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
  onLinkClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, onLinkClick }) => {
  const { t } = useTranslation();

  return (
    <div
      className={`relative z-[90] h-full transition-all duration-300 ease-in-out pointer-events-auto ${isCollapsed ? "w-20" : "w-64"}`}
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
