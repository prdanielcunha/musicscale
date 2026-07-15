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
        <div className="absolute top-[calc(100%+8px)] left-0 w-64 bg-white/95 dark:bg-[#1A1A1C]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 origin-top-left">
          <div className="absolute inset-0 cinematic-noise mix-blend-overlay pointer-events-none rounded-2xl"></div>
          <div className="px-3 pt-3 pb-2 border-b border-black/[0.04] dark:border-white/5 relative z-10">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {t("orgPicker.title", "Alternar Organização")}
            </h4>
          </div>
          <div className="p-1 max-h-60 overflow-y-auto custom-scrollbar relative z-10">
            {availableOrgs.map((org) => {
              const isActive = org.id === effectiveOrganizationId;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id)}
                  disabled={isActive}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isActive 
                      ? "bg-black/[0.03] dark:bg-white/[0.06] text-slate-900 dark:text-white" 
                      : "text-slate-600 dark:text-slate-300 md:hover:bg-slate-100 md:hover:text-slate-900 md:dark:hover:bg-white/5 md:dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${isActive ? 'bg-primary/20 text-primary dark:text-primary-light' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-400'}`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold tracking-wide">{org.name}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">{org.role}</span>
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary dark:text-primary-light" />}
                </button>
              );
            })}
          </div>
          <div className="p-1 border-t border-black/[0.04] dark:border-white/5 relative z-10">
             <button
                onClick={() => window.location.href = 'https://millionsnest.com'}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-500 dark:text-slate-400 transition-colors md:hover:bg-slate-100 md:hover:text-slate-900 md:dark:hover:bg-white/5 md:dark:hover:text-white"
             >
                <div className="p-1.5 rounded-md bg-slate-100 dark:bg-white/5">
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
