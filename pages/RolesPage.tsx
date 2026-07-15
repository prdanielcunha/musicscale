import { logger } from "../lib/logger";

import React, { useState, useMemo, useEffect } from "react";
import { useMusic } from "../contexts/MusicDataContext";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../contexts/ApiContext";
// FIX: Removed firestoreService import in favor of useApi
import type { Role, Permissions, UserProfile } from "../types";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Spinner from "../components/common/Spinner";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import SuccessModal from "../components/common/SuccessModal";
import { KeyPermissionsIcon } from "../components/icons/KeyPermissionsIcon";
import { UsersIcon } from "../components/icons/UsersIcon";
import { RepertoireIcon } from "../components/icons/RepertoireIcon";
import { CalendarIcon } from "../components/icons/CalendarIcon";
import { EyeIcon } from "../components/icons/EyeIcon";
import { UserCogIcon } from "../components/icons/UserCogIcon";
import { ChordsIcon } from "../components/icons/ChordsIcon";
import { ShieldIcon } from "../components/icons/ShieldIcon";

const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
      clipRule="evenodd"
    />
  </svg>
);
const EditIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"
    />
  </svg>
);
const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const formInputClass = "mt-1 input-base";
const formLabelClass =
  "block text-sm font-medium text-slate-600 dark:text-gray-300";

const permissionConfig: Record<
  keyof Permissions,
  {
    label: string;
    description: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
  }
> = {
  canManageUsers: {
    label: "Gerenciar Usuários",
    description: "Pode visualizar, editar e excluir usuários.",
    icon: UsersIcon,
  },
  canManageRoles: {
    label: "Gerenciar Funções",
    description: "Pode criar, editar e excluir funções e suas permissões.",
    icon: UserCogIcon,
  },
  canManageRepertoire: {
    label: "Gerenciar Repertório",
    description:
      "Pode adicionar, editar e excluir músicas e itens do banco de dados.",
    icon: RepertoireIcon,
  },
  canManageScales: {
    label: "Gerenciar Escalas",
    description: "Pode criar, editar e excluir escalas de eventos.",
    icon: CalendarIcon,
  },
  canManageChords: {
    label: "Gerenciar Cifras",
    description: "Pode adicionar e editar as cifras das músicas.",
    icon: ChordsIcon,
  },
  canViewContent: {
    label: "Visualizar Conteúdo",
    description:
      "Permissão básica para ver o conteúdo principal do aplicativo.",
    icon: EyeIcon,
  },
};

const defaultPermissions: Permissions = {
  canManageUsers: false,
  canManageRoles: false,
  canManageRepertoire: false,
  canManageScales: false,
  canManageChords: false,
  canViewContent: true,
};

const arePermissionsEqual = (p1: Permissions, p2: Permissions) => {
  const keys = Object.keys(p1) as (keyof Permissions)[];
  const keys2 = Object.keys(p2) as (keyof Permissions)[];
  if (keys.length !== keys2.length) return false;
  return keys.every((key) => p1[key] === p2[key]);
};

const RoleFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (role: Omit<Role, "id"> | Role) => Promise<void>;
  roleToEdit?: Role | null;
  isSubmitting: boolean;
}> = ({ isOpen, onClose, onSave, roleToEdit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: defaultPermissions,
  });

  useEffect(() => {
    if (roleToEdit) {
      setFormData({
        name: roleToEdit.name,
        description: roleToEdit.description,
        permissions: roleToEdit.permissions,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        permissions: defaultPermissions,
      });
    }
  }, [roleToEdit, isOpen]);

  useEffect(() => {
    if (!roleToEdit) {
      // Only for new roles, pre-fill permissions based on name
      const name = formData.name.toLowerCase().trim();
      let newPermissions = { ...defaultPermissions };

      if (name === "líder" || name === "lider" || name === "ministro") {
        newPermissions = {
          ...newPermissions,
          canManageRepertoire: true,
          canManageScales: true,
          canManageChords: true,
        };
      } else if (name === "músico" || name === "musico") {
        newPermissions = { ...newPermissions, canManageChords: true };
      } else if (name === "administrador") {
        newPermissions = {
          canManageUsers: true,
          canManageRoles: true,
          canManageRepertoire: true,
          canManageScales: true,
          canManageChords: true,
          canViewContent: true,
        };
      }

      // Only update state if the permissions have actually changed to prevent loops
      // Use helper function instead of JSON.stringify to prevent circular structure errors
      if (!arePermissionsEqual(formData.permissions, newPermissions)) {
        setFormData((prev) => ({
          ...prev,
          permissions: newPermissions,
        }));
      }
    }
  }, [formData.name, formData.permissions, roleToEdit]);

  const handlePermissionChange = (perm: keyof Permissions) => {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [perm]: !prev.permissions[perm] },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = roleToEdit ? { ...roleToEdit, ...formData } : formData;
    onSave(finalData);
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button type="submit" form="role-form" disabled={isSubmitting}>
        {isSubmitting ? <Spinner size="sm" /> : "Salvar Função"}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={roleToEdit ? "Editar Função" : "Criar Nova Função"}
      footer={footer}
    >
      <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className={formLabelClass}>
            Nome da Função
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((p) => ({ ...p, name: e.target.value }))
            }
            className={formInputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="description" className={formLabelClass}>
            Descrição
          </label>
          <input
            type="text"
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData((p) => ({ ...p, description: e.target.value }))
            }
            className={formInputClass}
            required
          />
        </div>
        <div>
          <h4 className="text-base font-medium text-slate-700 dark:text-gray-200 mb-2">
            Permissões
          </h4>
          <div className="space-y-4">
            {Object.entries(permissionConfig).map(
              ([key, { label, description, icon: Icon }]) => (
                <div key={key} className="flex items-start gap-3">
                  <input
                    id={key}
                    type="checkbox"
                    checked={formData.permissions[key as keyof Permissions]}
                    onChange={() =>
                      handlePermissionChange(key as keyof Permissions)
                    }
                    className="h-5 w-5 rounded mt-0.5 bg-slate-200 dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-primary focus:ring-primary-dark"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={key}
                      className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </label>
                    <p className="text-sm text-slate-500 dark:text-gray-400">
                      {description}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </form>
      {roleToEdit && (roleToEdit.createdAt || roleToEdit.lastModifiedAt) && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-gray-700 text-xs text-slate-400 dark:text-gray-500 space-y-1 text-center">
          {roleToEdit.createdAt && roleToEdit.createdBy && (
            <p>
              Criado por {roleToEdit.createdBy.displayName} em{" "}
              {new Date(roleToEdit.createdAt).toLocaleString("pt-BR")}.
            </p>
          )}
          {roleToEdit.lastModifiedAt && roleToEdit.lastModifiedBy && (
            <p>
              Última modificação por {roleToEdit.lastModifiedBy.displayName} em{" "}
              {new Date(roleToEdit.lastModifiedAt).toLocaleString("pt-BR")}.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

const RolesPage: React.FC = () => {
  const { roles, refreshData } = useMusic();
  const { user, userProfile, refreshAuthData } = useAuth();
  const api = useApi();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnsuringAdmin, setIsEnsuringAdmin] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState("");
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successConfig, setSuccessConfig] = useState<{
    title: string;
    message: string;
    actionText: string;
    onAction: () => void;
    stayText: string;
  } | null>(null);

  const sortedRoles = useMemo(() => {
    const HIERARCHY = [
      "Administrador",
      "Líder",
      "Ministro",
      "Músico",
      "Vocal",
      "Visitante",
    ];
    return [...roles].sort((a, b) => {
      const indexA = HIERARCHY.indexOf(a.name);
      const indexB = HIERARCHY.indexOf(b.name);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [roles]);

  const handleOpenForm = (role?: Role) => {
    setRoleToEdit(role || null);
    setIsFormOpen(true);
  };

  const handleSaveRole = async (roleData: Omit<Role, "id"> | Role) => {
    if (!userProfile || !api) return;
    setIsSubmitting(true);
    try {
      if ("id" in roleData) {
        await api.roles.update(roleData.id, roleData);
      } else {
        await api.roles.create(roleData);
      }
      await refreshData();
      await refreshAuthData();
      setIsFormOpen(false);
    } catch (error) {
      logger.error("Failed to save role", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (role: Role) => {
    if (!userProfile?.organizationId || !api) return;
    const allUsers = await api.users.list();
    const usersInRole = allUsers.filter((u) => u.roleId === role.id).length;
    if (usersInRole > 0) {
      setDeleteWarning(
        `Esta função não pode ser excluída pois ${usersInRole} usuário(s) estão atribuídos a ela. Reatribua os usuários antes de excluir.`,
      );
    } else {
      setDeleteWarning("");
    }
    setRoleToDelete(role);
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete || deleteWarning || !api) {
      if (deleteWarning) setRoleToDelete(null);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.roles.delete(roleToDelete.id);
      await refreshData();
      setRoleToDelete(null);
    } catch (error) {
      logger.error("Failed to delete role", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnsureAdmin = async () => {
    if (!user || !userProfile) return;
    setIsEnsuringAdmin(true);
    try {
      const adminRoleName = "Administrador";
      let adminRole = roles.find((r) => r.name === adminRoleName);
      let adminRoleId: string;

      const fullPermissions: Permissions = {
        canManageUsers: true,
        canManageRoles: true,
        canManageRepertoire: true,
        canManageScales: true,
        canManageChords: true,
        canViewContent: true,
      };

      if (adminRole) {
        adminRoleId = adminRole.id;
        const needsUpdate = Object.keys(fullPermissions).some(
          (p) => adminRole!.permissions[p as keyof Permissions] !== true,
        );
        if (needsUpdate && api) {
          await api.roles.update(adminRole.id, {
            ...adminRole,
            permissions: fullPermissions,
          });
        }
      } else if (api) {
        const newRoleData: Omit<Role, "id"> = {
          name: adminRoleName,
          description: "Acesso total a todas as funcionalidades do sistema.",
          permissions: fullPermissions,
        };
        adminRoleId = await api.roles.create(newRoleData);
      } else {
        return;
      }

      if (userProfile.roleId === adminRoleId) {
        setSuccessConfig({
          title: "Acesso Confirmado",
          message: "Você já possui permissões de administrador.",
          actionText: "OK",
          onAction: () => setIsSuccessModalOpen(false),
          stayText: "Fechar",
          onStay: () => setIsSuccessModalOpen(false),
        });
        setIsSuccessModalOpen(true);
        return;
      }

      if (api) {
        await api.users.update(user.uid, { roleId: adminRoleId });
        await refreshData();
        await refreshAuthData();
      }

      setSuccessConfig({
        title: "Acesso de Administrador Concedido",
        message:
          "Você agora possui permissões de administrador. A página será recarregada para aplicar as alterações.",
        actionText: "Recarregar Agora",
        onAction: () => window.location.reload(),
        stayText: "Recarregar Depois",
        onStay: () => setIsSuccessModalOpen(false),
      });
      setIsSuccessModalOpen(true);
    } catch (e) {
      logger.error("Failed to ensure admin role", e);
    } finally {
      setIsEnsuringAdmin(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Gerenciamento de Funções
          </h1>
          <p className="text-slate-500 dark:text-gray-400">
            Crie e edite as funções e permissões para os usuários do sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleEnsureAdmin}
            variant="secondary"
            disabled={isEnsuringAdmin}
            leftIcon={
              isEnsuringAdmin ? (
                <Spinner size="sm" />
              ) : (
                <ShieldIcon className="w-4 h-4" />
              )
            }
          >
            Garantir Acesso Admin
          </Button>
          <Button onClick={() => handleOpenForm()} leftIcon={<PlusIcon />}>
            Criar Nova Função
          </Button>
        </div>
      </div>

      <Card padding="large">
        <div className="space-y-4">
          {sortedRoles.map((role) => (
            <div
              key={role.id}
              className="p-5 border border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <KeyPermissionsIcon className="w-5 h-5 text-primary" />
                  {role.name}
                </h3>
                <p className="text-sm text-slate-500 font-medium pl-7">
                  {role.description}
                </p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleOpenForm(role)}
                  leftIcon={<EditIcon />}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDeleteClick(role)}
                  leftIcon={<TrashIcon />}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <RoleFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveRole}
        roleToEdit={roleToEdit}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={!!roleToDelete}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleDeleteRole}
        title={
          deleteWarning ? "Ação Bloqueada" : `Excluir "${roleToDelete?.name}"?`
        }
        message={
          deleteWarning ||
          "Tem certeza que deseja excluir esta função? Esta ação não pode ser desfeita."
        }
        isLoading={isSubmitting}
        confirmText={deleteWarning ? "OK" : "Confirmar"}
      />

      {successConfig && (
        <SuccessModal
          isOpen={isSuccessModalOpen}
          onClose={() => setIsSuccessModalOpen(false)}
          title={successConfig.title}
          message={successConfig.message}
          actionText={successConfig.actionText}
          onAction={successConfig.onAction}
          stayText={successConfig.stayText}
          onStay={() => setIsSuccessModalOpen(false)}
        />
      )}
    </div>
  );
};

export default RolesPage;
