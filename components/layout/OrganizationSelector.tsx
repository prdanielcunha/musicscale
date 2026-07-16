import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useEcosystem } from "../../contexts/EcosystemContext";
import { ecosystemBridge } from "../../services/ecosystem/EcosystemBridge";
import { useApi } from "../../contexts/ApiContext";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export const OrganizationSelector: React.FC = () => {
  const { effectiveOrganizationId, effectiveOrganizationName, user } = useAuth();
  const { context: ecoContext } = useEcosystem();
  const api = useApi();
  const { t } = useTranslation();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableOrgs = ecoContext?.organizationsAvailable || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (availableOrgs.length === 0) {
    return (
      <div className="flex flex-col min-w-0">
        <p className="text-[11px] font-medium text-slate-400 tracking-wider truncate uppercase">
          {effectiveOrganizationName || "MusicScale"}
        </p>
      </div>
    );
  }

  const handleSwitchOrg = async (orgId: string) => {
    setIsOpen(false);
    if (orgId === effectiveOrganizationId) return;

    // Send the intent to MillionsNest
    ecosystemBridge.publishEvent({
      type: "navigation",
      payload: { action: "switch_org", orgId },
      timestamp: Date.now()
    });

    // Write-back directly so standalone or ecosystem re-hydration knows the intent
    if (user && api) {
      try {
        await api.users.update(user.uid, { activeOrganizationId: orgId });
      } catch (err) {
        console.error("Failed to persist organization change:", err);
      }
    }
  };


  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t("orgPicker.title", "Alternar Organização")}
        className="flex items-center gap-1.5 focus:outline-none group premium-interactive"
      >
        <span className="text-[11px] font-medium text-slate-400 group-hover:text-white transition-colors tracking-wider truncate uppercase">
          {effectiveOrganizationName || "Sua Organização"}
        </span>
        <ChevronDown 
          className={`w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-[280px] md:w-64 bg-white/[0.99] dark:bg-[#0D0F12]/[0.99] backdrop-blur-[32px] backdrop-saturate-[135%] isolation-isolate border border-black/10 dark:border-white/[0.12] rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.8)] ring-1 ring-black/5 dark:ring-white/5 z-[100] animate-in fade-in slide-in-from-top-2 origin-top-left">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.05] via-white/[0.01] to-transparent" />
          <div className="absolute inset-0 cinematic-noise mix-blend-overlay opacity-[0.08] pointer-events-none rounded-2xl"></div>
          <div className="px-3 pt-3 pb-2 border-b border-black/10 dark:border-white/[0.08] relative z-10">
            <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t("orgPicker.title", "Alternar Organização")}
            </h4>
          </div>
          <div className="p-1.5 max-h-[60vh] md:max-h-60 overflow-y-auto custom-scrollbar relative z-10 flex flex-col gap-1">
            {availableOrgs.map((org) => {
              const isActive = org.id === effectiveOrganizationId;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id)}
                  disabled={isActive}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all ${
                    isActive 
                      ? "bg-black/[0.04] dark:bg-white/[0.08] ring-1 ring-black/5 dark:ring-white/10 text-slate-900 dark:text-white shadow-sm" 
                      : "text-slate-600 dark:text-slate-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 truncate pr-2">
                    <div className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
                      isActive 
                        ? 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light ring-1 ring-primary/20' 
                        : 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col truncate">
                      <span className={`text-[13px] tracking-wide truncate ${isActive ? 'font-bold' : 'font-semibold'}`}>
                        {org.name}
                      </span>
                      <span className={`text-[10px] uppercase tracking-widest mt-0.5 truncate ${
                        isActive ? 'text-slate-600 dark:text-slate-400 font-bold' : 'text-slate-500 dark:text-slate-500 font-semibold'
                      }`}>
                        {org.role}
                      </span>
                    </div>
                  </div>
                  {isActive && (
                    <div className="flex-shrink-0 ml-1">
                      <Check className="w-4 h-4 text-primary dark:text-primary-light drop-shadow-sm" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="p-1.5 mt-1 border-t border-black/10 dark:border-white/[0.08] relative z-10 bg-black/[0.01] dark:bg-white/[0.01]">
             <button
                onClick={() => window.location.href = 'https://millionsnest.com'}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left text-slate-600 dark:text-slate-300 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white"
             >
                <div className="p-1.5 rounded-lg flex-shrink-0 bg-black/5 dark:bg-white/5">
                   <Building2 className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold tracking-wide">Gerenciar Organizações</span>
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
