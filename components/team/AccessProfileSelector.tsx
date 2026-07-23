import React from "react";
import { useTranslation } from "react-i18next";
import { Role } from "../../types";
import { Check } from "lucide-react";

interface AccessProfileSelectorProps {
  roles: Role[];
  selectedRoleId: string | null;
  onSelect: (roleId: string) => void;
}

export const AccessProfileSelector: React.FC<AccessProfileSelectorProps> = ({
  roles,
  selectedRoleId,
  onSelect,
}) => {
  const { t } = useTranslation();

  const getPermissionLabel = (key: string) => {
    return t(`teamSetup.access.permissions.${key}`, "");
  };

  return (
    <div className="space-y-4">
      {roles.map((role) => {
        const isSelected = selectedRoleId === role.id;
        
        // Convert permissions to human readable
        const permissions: string[] = [];
        if (role.permissions.canManageUsers) permissions.push(getPermissionLabel("canManageUsers") || "Administrar pessoas da equipe");
        if (role.permissions.canManageRoles) permissions.push(getPermissionLabel("canManageRoles") || "Configurar perfis de acesso");
        if (role.permissions.canManageRepertoire) permissions.push(getPermissionLabel("canManageRepertoire") || "Adicionar e editar músicas");
        if (role.permissions.canManageScales) permissions.push(getPermissionLabel("canManageScales") || "Criar e editar escalas");
        if (role.permissions.canManageChords) permissions.push(getPermissionLabel("canManageChords") || "Editar cifras");
        if (role.permissions.canViewContent) permissions.push(getPermissionLabel("canViewContent") || "Consultar conteúdo e compromissos");

        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            aria-pressed={isSelected}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              isSelected
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "border-slate-200 dark:border-white/10 hover:border-primary/50"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">{role.name}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{role.description}</p>
                
                <ul className="space-y-1">
                  {permissions.map((perm, idx) => (
                    <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-slate-400" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                isSelected 
                  ? "border-primary bg-primary text-white" 
                  : "border-slate-300 dark:border-slate-600"
              }`}>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
