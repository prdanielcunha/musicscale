import { logger } from "../lib/logger";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getPrimaryDisplayRole, getRoleBadgeStyles } from '../utils/roleResolver';
import { useNavigate, useLocation } from "react-router-dom";
import { doc, updateDoc, deleteDoc, collection, setDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { sendResetEmail } from "../services/authService";
import type { UserProfile, Role, Instrument } from "../types";
import { useAuth, useLimits } from "../contexts/AuthContext";
import { useApi } from "../contexts/ApiContext";
import { useMusic } from "../contexts/MusicDataContext";
import { useCapability } from "../hooks/useCapability";
import { evaluateTeamSetup } from "../utils/teamSetup";

import { TeamMemberAccessPolicy, TeamMemberSetupDraft, normalizeSpecialtyIds, TeamMemberSetupPayload } from '../utils/teamMemberSetup';
import { ExistingMemberSetupGuide } from '../components/team/ExistingMemberSetupGuide';

import { TeamSetupProgressCard } from "../components/team/TeamSetupProgressCard";
import Spinner from "../components/common/Spinner";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import ConfirmationModal from "../components/common/ConfirmationModal";
import Modal from "../components/common/Modal";
import Tag from "../components/common/Tag";
import { UserIcon } from "../components/icons/UserIcon";
import { ShieldIcon } from "../components/icons/ShieldIcon";
import { BookOpenIcon } from "../components/icons/BookOpenIcon";
import { MusicNoteIcon } from "../components/icons/MusicNoteIcon";
import { ArrowLeftIcon } from "../components/icons/ArrowLeftIcon";
import { TrashIcon } from "../components/icons/TrashIcon";
import { UserPlusIcon } from "../components/icons/UserPlusIcon";
import { ClipboardListIcon } from "../components/icons/ClipboardListIcon";
import { KeyIcon } from "../components/icons/KeyIcon";
import { CheckIcon } from "../components/icons/CheckIcon";
import { HistoryIcon } from "../components/icons/HistoryIcon";
import { UserUsageBanner } from "../components/billing/UserUsageBanner";
import { useMusicScaleUsage } from "../hooks/useMusicScaleEntitlements";
import { UpgradePlanModal } from "../components/premium/EntitlementGates";
import { Lock } from "lucide-react";
import { canAssignOrganizationRole, canChangeOrganizationRole } from "../utils/roleHierarchy";
import { useToast } from "../contexts/ToastContext";
import { isGlobalPrivilegedUser } from "../hooks/useEcosystemAdmin";

const MailIconComp: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
    />
  </svg>
);

const getRoleStyle = (roleName: string) => {
  const norm = (roleName || '').toLowerCase();
  
  if (norm.includes('ceo')) {
    return {
      icon: UserIcon,
      color: "text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 shadow-[0_0_10px_rgba(255,215,0,0.1)]",
      badgeItem: "bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 shadow-[0_0_10px_rgba(255,215,0,0.1)]"
    }
  }

  if (norm.includes('dono')) {
    return {
      icon: ShieldIcon,
      color: "text-[#A855F7] bg-[#A855F7]/10 border border-[#A855F7]/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]",
      badgeItem: "bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
    }
  }

  switch (roleName) {
    case "Administrador":
      return {
        icon: ShieldIcon,
        color: "text-red-500 bg-red-50 dark:bg-red-500/10",
        badgeItem: "bg-red-500/10 text-red-500"
      };
    case "Líder":
      return {
        icon: BookOpenIcon,
        color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
        badgeItem: "bg-amber-500/10 text-amber-500"
      };
    case "Ministro":
      return {
        icon: ClipboardListIcon,
        color: "text-purple-500 bg-purple-50 dark:bg-purple-500/10",
        badgeItem: "bg-purple-500/10 text-purple-500"
      };
    case "Músico":
      return {
        icon: MusicNoteIcon,
        color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
        badgeItem: "bg-blue-500/10 text-blue-500"
      };
    default:
      return {
        icon: UserIcon,
        color: "text-slate-500 bg-slate-50 dark:bg-white/5",
        badgeItem: "bg-slate-500/10 text-slate-500"
      };
  }
};

const HIERARCHY = [
  "CEO",
  "Dono",
  "Administrador",
  "Líder",
  "Ministro",
  "Músico",
  "Vocal",
  "Visitante",
];

const sortRolesByHierarchy = (roles: Role[]) => {
  return [...roles].sort((a, b) => {
    const indexA = HIERARCHY.indexOf(a.name);
    const indexB = HIERARCHY.indexOf(b.name);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

const getRoleKeyFromName = (roleName: string): string => {
  const name = (roleName || "").toLowerCase();
  if (name.includes("dono") || name === "owner" || name === "ceo" || name.includes("founder")) return "owner";
  if (name.includes("administrador") || name === "admin") return "admin";
  if (name.includes("líder") || name.includes("lider") || name.includes("ministro") || name === "leader") return "leader";
  if (name.includes("músico") || name.includes("musico") || name.includes("vocal") || name === "musician") return "musician";
  return "viewer"; // Default mapping for 'member' or 'viewer'
};

const getRoleKeyFromId = (roleId: string, availableRoles: Role[]): string => {
  const roleName = availableRoles.find(r => r.id === roleId)?.name || "";
  return getRoleKeyFromName(roleName);
};

interface UserDetailsModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  roles: Role[];
  instruments: Instrument[];
  onClose: () => void;
  onSave: (uid: string, data: Partial<UserProfile>) => Promise<void>;
  onDelete: (uid: string) => Promise<void>;
  isSubmitting: boolean;
  allUsers: UserProfile[];
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  isOpen,
  user,
  roles,
  instruments,
  onClose,
  onSave,
  onDelete,
  isSubmitting,
  allUsers,
}) => {
  const { t, i18n } = useTranslation();
  const { user: currentUser, userProfile, organization } = useAuth();
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editSpecialtyIds, setEditSpecialtyIds] = useState<string[]>([]);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isGlobal = isGlobalPrivilegedUser(currentUser, userProfile);

  useEffect(() => {
    if (user) {
      setEditName(user.displayName || "");
      setEditEmail(user.email || "");
      setEditRoleId(user.roleId || "");
      setEditSpecialtyIds(user.specialtyIds || []);
      setResetSent(false);
    }
  }, [user, isOpen]);

  if (!user) return null;

  const handleSave = async () => {
    await onSave(user.uid, {
      displayName: editName,
      email: editEmail,
      roleId: editRoleId,
      specialtyIds: editSpecialtyIds,
    });
    onClose();
  };

  const handleToggleSpecialty = (id: string) => {
    setEditSpecialtyIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSendReset = async () => {
    if (!editEmail) return;
    setIsSendingReset(true);
    try {
      await sendResetEmail(editEmail);
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (e) {
      logger.error(e);
      alert(
        "Erro ao enviar e-mail de recuperação. Verifique se o e-mail é válido.",
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  const sortedRoles = sortRolesByHierarchy(roles);
  const currentRole = roles.find((r) => r.id === user.roleId);

  // Compute hierarchy checks
  const targetRoleKey = getRoleKeyFromId(user.roleId, roles);
  const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");
  const otherOwnersActiveCount = allUsers.filter(u => u.organizationId === userProfile?.organizationId && u.uid !== user.uid && (u.role === 'owner' || u.role === 'Dono' || u.uid === organization?.ownerUserId)).length;

  const roleCtx = {
    isGlobalPrivilegedUser: isGlobal,
    actorSystemRole: userProfile?.systemRole,
    actorOrganizationRole: actorRoleKey,
    targetOrganizationRole: targetRoleKey,
    isSelfChange: user.uid === currentUser?.uid,
    otherOwnersActiveCount
  };

  const checkChange = canChangeOrganizationRole(actorRoleKey, targetRoleKey, targetRoleKey, roleCtx);
  const isRoleEditable = checkChange.canChange;

  const allowedSortedRoles = sortedRoles.filter((r) => {
    const specRoleKey = getRoleKeyFromName(r.name);
    const checkAssign = canAssignOrganizationRole(actorRoleKey, specRoleKey, {
      ...roleCtx,
      newOrganizationRole: specRoleKey
    });
    return checkAssign.canAssign;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("users.user_mgmt", "Gestão de Usuário")}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-8 pb-4">
        {/* Header com Avatar */}
        <div className="flex items-center gap-6 p-5 bg-white dark:bg-gray-800/40 rounded-3xl border border-slate-200 dark:border-gray-700 shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-slate-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-primary/10">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-10 h-10 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                {user.displayName || t("profile.no_name", "Sem nome")}
              </h3>
              {isGlobal && user.uid === currentUser?.uid && (
                <Tag className="!bg-[#3B82F6]/10 !text-[#3B82F6] font-bold text-[9px] uppercase tracking-wider">
                  {t("users.global_access", "Acesso Global (CEO)")}
                </Tag>
              )}
            </div>
            <p className="text-slate-500 dark:text-gray-400 flex items-center gap-1.5 text-sm">
              <MailIconComp className="w-4 h-4 ml-0.5" />
              {user.email}
            </p>
            <div className="mt-2 flex gap-2">
              <Tag className="!bg-primary/10 !text-primary !font-bold uppercase !text-[10px] tracking-widest">
                {currentRole?.name}
              </Tag>
              {user.specialtyIds && user.specialtyIds.length > 0 && (
                <Tag className="!bg-slate-100 dark:!bg-gray-700 !text-slate-500 dark:!text-gray-400 !text-[10px] font-bold uppercase">
                  {t("users.specialties_count", "{{count}} Especialidades", { count: user.specialtyIds.length })}
                </Tag>
              )}
            </div>
          </div>
        </div>

        {/* Formulário Principal */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 ml-1">
                {t("users.disp_name", "Nome de Exibição")}
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!isRoleEditable && user.uid !== currentUser?.uid}
                className="input-base disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder={t("profile.full_name", "Seu nome completo")}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 ml-1">
                {t("users.profile_email", "E-mail do Perfil")}
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={!isRoleEditable && user.uid !== currentUser?.uid}
                className="input-base disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="exemplo@email.com"
              />
            </div>
          </div>
          <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-2 ml-1">
                {t("users.system_role", "Função no Sistema")}
              </label>
            <select
              value={editRoleId}
              onChange={(e) => setEditRoleId(e.target.value)}
              disabled={!isRoleEditable}
              className="input-base px-3 py-2 text-[14px] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {allowedSortedRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {!isRoleEditable && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-semibold flex items-center gap-1 leading-normal bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                ⚠️ {checkChange.error || t("users.role_change_error", "Você não pode alterar o cargo de alguém com nível hierárquico igual ou superior ao seu.")}
              </p>
            )}
          </div>
        </div>

        {/* Edição de Especialidades */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 uppercase mb-3 ml-1">
            {t("users.specialties_inst", "Especialidades / Instrumentos")}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {instruments.map((inst) => {
              const isSelected = editSpecialtyIds.includes(inst.id);
              const isCellDisabled = !isRoleEditable && user.uid !== currentUser?.uid;
              return (
                <button
                  key={inst.id}
                  onClick={() => handleToggleSpecialty(inst.id)}
                  disabled={isCellDisabled}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all duration-200 ${
                    isSelected
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "bg-white dark:bg-gray-800/40 border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:border-slate-300"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <span className="truncate mr-2">{inst.name}</span>
                  {isSelected && (
                    <CheckIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seção de Senha e Segurança */}
        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left flex-1">
              <h4 className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 justify-center sm:justify-start text-sm">
                <KeyIcon className="w-4 h-4" />
                {t("users.password_reset", "Redefinição de Senha")}
              </h4>
              <p className="text-xs text-blue-700/70 dark:text-blue-400/70 mt-1 leading-relaxed">
                {t("users.password_reset_desc", 'Alterar o e-mail aqui corrige apenas o registro. Se o login original estiver errado, o ideal é Excluir o cadastro e criá-lo novamente com os dados corretos.')}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSendReset}
              disabled={isSendingReset || resetSent}
              className={`whitespace-nowrap transition-all ${resetSent ? "!bg-green-500 !text-white !border-transparent" : ""}`}
            >
              {isSendingReset ? (
                <Spinner size="sm" />
              ) : resetSent ? (
                t("users.email_sent", "E-mail Enviado!")
              ) : (
                t("users.send_pwd_link", "Enviar Link de Senha")
              )}
            </Button>
          </div>
        </div>

        {/* Histórico do Registro */}
        <div className="p-4 bg-slate-50 dark:bg-gray-800/30 rounded-2xl border border-slate-200 dark:border-gray-700/50">
          <h4 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HistoryIcon className="w-3.5 h-3.5" />
            {t("users.history_title", "Histórico do Registro")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">
                {t("users.created_at", "Data de Criação")}
              </p>
              <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleString(i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR', {
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                  : t("users.not_available", "Indisponível")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">
                {t("users.last_modified", "Última Edição")}
              </p>
              <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                {user.lastModifiedAt
                  ? new Date(user.lastModifiedAt).toLocaleString(i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR', {
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                  : t("users.not_edited", "Ainda não editado")}
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-gray-700">
          <div>
            {isRoleEditable && user.uid !== currentUser?.uid ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-600 transition-colors px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                <TrashIcon className="w-4 h-4" />
                {t("users.delete_signup", "Excluir Cadastro")}
              </button>
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500 italic px-4 py-2">
                {t("users.delete_not_avail", "Exclusão não disponível para este cargo")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1 sm:flex-none"
            >
              {t("common.cancel_btn", "Cancelar")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting || (!isRoleEditable && user.uid !== currentUser?.uid)}
              className="flex-1 sm:flex-none"
            >
              {isSubmitting ? <Spinner size="sm" /> : t("common.save_changes", "Salvar Alterações")}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete(user.uid);
          onClose();
        }}
        title={t("users.delete_user_title", "Excluir Usuário?")}
        message={t("users.delete_user_desc", "Tem certeza que deseja remover {{name}}? Se houver erro crítico no login, excluir e recriar é a opção mais segura.", { name: user.displayName || user.email })}
        confirmText={t("users.delete_user_confirm", "Sim, Excluir")}
      />
    </Modal>
  );
};

interface RoleCardProps {
  role: Role;
  count: number;
  onSelect: (role: Role) => void;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, count, onSelect }) => {
  const { t } = useTranslation();
  const style = getRoleStyle(role.name);
  const Icon = style.icon;

  return (
    <Card
      onClick={() => onSelect(role)}
      className="p-6 cursor-pointer group transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 hover:shadow-sm active:scale-[0.99] flex flex-col justify-between min-h-[160px]"
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${style.color}`}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight">
            {role.name}
          </h3>
          <p className="text-[13px] text-slate-500 mt-1 leading-snug">
            {role.description}
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
        <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
          {t("users.total_users", "Total de Usuários")}
        </span>
        <span className="px-2.5 py-1 text-[12px] font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-md">
          {count}
        </span>
      </div>
    </Card>
  );
};

export const InviteMemberModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  role: Role;
}> = ({ isOpen, onClose, role }) => {
  const { t } = useTranslation();
  const { userProfile, user: currentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [error, setError] = useState("");

  const handleInvite = async () => {
    if (!email) return setError(t("users.type_email_error", "Por favor, digite um e-mail."));
    if (role.name === 'Dono' || role.name === 'Owner') {
      return setError(t("users.cannot_invite_owner", "Não é permitido convidar alguém diretamente como Dono."));
    }
    if (!currentUser) {
      return setError(t("users.auth_error", "Usuário não autenticado."));
    }
    
    setError("");
    setIsSubmitting(true);
    try {
      const idToken = await currentUser.getIdToken();
      // Use activeOrganizationId explicitly
      const activeOrgId = userProfile?.activeOrganizationId || userProfile?.primaryOrganizationId || userProfile?.organizationId;
      
      if (!activeOrgId) {
        throw new Error(t("users.no_org_error", "Nenhuma organização ativa encontrada."));
      }

      const response = await fetch("/api/orgs/invite", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          organizationId: activeOrgId,
          email: email,
          roleId: role.id
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("users.invite_error", "Erro ao convidar."));
      
      const fullUrl = `${window.location.origin}${data.link}`;
      setInviteLink(fullUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) { setInviteLink(""); setEmail(""); setError(""); }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("users.invite_for", "Convidar para: {{name}}", { name: role.name })}>
      <div className="space-y-4">
        {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
        
        {!inviteLink ? (
          <>
            <p className="text-sm text-slate-500">{t("users.invite_desc", "Digite o e-mail para convidar alguém para sua equipe ministerial.")}</p>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t("users.email_label", "E-mail")}</label>
              <input
                type="email"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base"
              />
            </div>
            <div className="mt-5 sm:flex sm:flex-row-reverse">
              <Button onClick={handleInvite} disabled={isSubmitting || !email}>
                {isSubmitting ? <Spinner size="sm" /> : t("users.generate_invite", "Gerar Convite & Enviar E-mail")}
              </Button>
              <Button variant="secondary" onClick={onClose} className="mt-3 w-full sm:mt-0 sm:w-auto">{t("common.cancel_btn", "Cancelar")}</Button>
            </div>
          </>
        ) : (
          <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20 text-center">
            <h4 className="text-green-700 dark:text-green-400 font-bold mb-2">{t("users.email_sent", "E-mail Enviado!")}</h4>
            <p className="text-sm text-green-600 dark:text-green-400/80 mb-4">{t("users.manual_invite_desc", "Caso prefira enviar manualmente, o link é:")}</p>
            <div className="flex items-center gap-2">
               <input type="text" readOnly value={inviteLink} className="input-base text-xs bg-white/50" />
               <Button onClick={() => navigator.clipboard.writeText(inviteLink)} variant="secondary" size="sm">{t("users.copiar", "Copiar")}</Button>
            </div>
            <Button onClick={onClose} className="w-full mt-4">{t("users.concluido", "Concluído")}</Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

const AddUsersToRoleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  role: Role;
  allUsers: UserProfile[];
  onAdd: (uids: string[]) => Promise<void>;
}> = ({ isOpen, onClose, role, allUsers, onAdd }) => {
  const { t } = useTranslation();
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedUids([]);
      setSearch("");
      setShowInvite(false);
    }
  }, [isOpen]);

  const filteredUsers = allUsers.filter(u => 
    u.roleId !== role.id && 
    (u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleUser = (uid: string) => {
    setSelectedUids(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onAdd(selectedUids);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (showInvite) {
     return <InviteMemberModal isOpen={true} onClose={() => setShowInvite(false)} role={role} />;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adicionar à função: ${role.name}`}>
       <div className="space-y-4">
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base text-sm"
          />
          <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-white/10 rounded-xl p-2">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-4">Nenhum outro usuário encontrado.</p>
            ) : (
              filteredUsers.map(u => (
                <div key={u.uid} onClick={() => toggleUser(u.uid)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedUids.includes(u.uid) ? 'bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                   <input type="checkbox" checked={selectedUids.includes(u.uid)} readOnly className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4" />
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-bold truncate text-slate-900 dark:text-white">{u.displayName}</p>
                     <p className="text-xs text-slate-500 truncate">{u.email}</p>
                   </div>
                   <div className="text-xs text-slate-400 capitalize">{u.role || 'Sem função'}</div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-between items-center mt-4 border-t border-slate-200 dark:border-white/10 pt-4">
             <button onClick={() => setShowInvite(true)} className="text-sm font-bold text-primary hover:text-primary-dark transition-colors">
                + Convidar novo por E-mail
             </button>
             <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={onClose} size="sm">Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving || selectedUids.length === 0} size="sm">
                   {isSaving ? <Spinner size="sm" /> : `Adicionar (${selectedUids.length})`}
                </Button>
             </div>
          </div>
       </div>
    </Modal>
  );
};

interface UserManagementViewProps {
  role: Role;
  initialUsers: UserProfile[];
  allUsers: UserProfile[];
  allRoles: Role[];
  instruments: Instrument[];
  onBack: () => void;
  refreshUsers: () => void;
}

const UserManagementView: React.FC<UserManagementViewProps> = ({
  role,
  initialUsers,
  allUsers,
  allRoles,
  instruments,
  onBack,
  refreshUsers,
}) => {
  const { t } = useTranslation();
  const { user: currentUser, userProfile, permissions, organization } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const isGlobal = isGlobalPrivilegedUser(currentUser, userProfile);
  const { usage, limits: musicScaleLimits } = useMusicScaleUsage();
  
  // Use MusicScale entitlements limits override if available
  const currentMembersCount = usage?.users ?? allUsers.length;
  const maxMembers = musicScaleLimits?.users !== undefined ? musicScaleLimits.users : -1;
  const isOverLimit = maxMembers !== -1 && currentMembersCount >= maxMembers;
  
  const api = useApi();
  const navigate = useNavigate();
  const [users, setUsers] = useState(initialUsers);
  const [changedUsers, setChangedUsers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Novo Estado para o Modal de Detalhes
  const [selectedUserForDetail, setSelectedUserForDetail] =
    useState<UserProfile | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "changeRole" | null>(
    null,
  );
  const [newRoleId, setNewRoleId] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);

  const canEditRoles = !!permissions?.manageMembers;

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const targetUser = allUsers.find(u => u.uid === memberId);
      const targetRoleKey = getRoleKeyFromId(targetUser?.roleId || "", allRoles);
      const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");
      const otherOwnersActiveCount = allUsers.filter(u => u.organizationId === userProfile?.organizationId && u.uid !== memberId && (u.role === 'owner' || u.role === 'Dono' || u.uid === organization?.ownerUserId)).length;

      const roleCtx = {
        isGlobalPrivilegedUser: isGlobal,
        actorSystemRole: userProfile?.systemRole,
        actorOrganizationRole: actorRoleKey,
        targetOrganizationRole: targetRoleKey,
        isSelfChange: memberId === currentUser?.uid,
        otherOwnersActiveCount
      };

      const checkChange = canChangeOrganizationRole(actorRoleKey, targetRoleKey, newRole, roleCtx);
      if (!checkChange.canChange) {
        toastError(checkChange.error || "Operação não permitida.");
        return;
      }

      // 1. Atualizar banco de dados via repository customizado (que atualiza 'users' e 'organization_members' corretamente garantindo o Sync)
      try {
        let finalRoleName = newRole;
        if (newRole.startsWith("role_")) {
           const newTargetRoleKey = getRoleKeyFromId(newRole, allRoles);
           finalRoleName = {
              owner: "owner",
              admin: "admin",
              leader: "leader",
              musician: "musician",
              viewer: "viewer"
           }[newTargetRoleKey] || newTargetRoleKey;
        }

        // Identify the exact matching role ID if needed for roleId mapping
        const matchingRole = allRoles.find(r => r.id === newRole || getRoleKeyFromName(r.name) === finalRoleName);
        const roleIdToSave = matchingRole ? matchingRole.id : newRole;

        await api.users.update(memberId, { 
          roleId: roleIdToSave,
          musicscaleRole: finalRoleName
        });
      } catch (err: any) {
        toastError(err?.message || "Erro de permissão no Firebase ao atualizar o cargo.");
        return;
      }
      const orgId = userProfile?.organizationId || currentUser?.uid;
      
      // Write audit log
      try {
        const auditRef = doc(collection(db, "audits"));
        await setDoc(auditRef, {
          action: "ROLE_UPDATE",
          targetCollection: "users",
          targetId: memberId,
          details: {
            oldRole: targetUser?.role || "viewer",
            newRole: newRole,
            actorRole: userProfile?.role || "viewer",
            isGlobal: isGlobal
          },
          user: {
            uid: currentUser?.uid,
            displayName: userProfile?.displayName,
            photoURL: userProfile?.photoURL
          },
          organizationId: orgId,
          timestamp: serverTimestamp()
        });
      } catch (logErr) {
        logger.error("Erro ao registrar log de auditoria operacional", logErr);
      }

      // 3. Atualizar o estado local
      setUsers((prev) => prev.map((u) => (u.uid === memberId ? { ...u, role: newRole } : u)));
      
      // Also update allUsers if needed
      if (allUsers) {
        const uToUpdate = allUsers.find(u => u.uid === memberId);
        if (uToUpdate) uToUpdate.role = newRole;
      }

      toastSuccess("Cargo atualizado com sucesso!");
      refreshUsers();
    } catch (e) {
      console.error("Erro ao atualizar função", e);
      toastError("Erro ao atualizar a função do membro.");
    }
  };

  const sortedAllRoles = useMemo(
    () => sortRolesByHierarchy(allRoles),
    [allRoles],
  );

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const handleRoleChange = (uid: string, newRoleId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.uid === uid ? { ...u, roleId: newRoleId } : u)),
    );
    setChangedUsers((prev) => ({ ...prev, [uid]: newRoleId }));
  };

  const handleSaveChanges = async () => {
    if (!api) return;
    setIsSaving(true);
    try {
      const updates = Object.keys(changedUsers).map((uid) => {
        const newRoleId = changedUsers[uid];
        let finalRoleName = newRoleId;
        if (newRoleId.startsWith("role_")) {
          const newTargetRoleKey = getRoleKeyFromId(newRoleId, allRoles);
          finalRoleName = {
              owner: "owner",
              admin: "admin",
              leader: "leader",
              musician: "musician",
              viewer: "viewer"
          }[newTargetRoleKey] || newTargetRoleKey;
        }

        const matchingRole = allRoles.find(r => r.id === newRoleId || getRoleKeyFromName(r.name) === finalRoleName);
        const roleIdToSave = matchingRole ? matchingRole.id : newRoleId;
        
        return api.users.update(uid, { roleId: roleIdToSave, musicscaleRole: finalRoleName });
      });
      await Promise.all(updates);
      setChangedUsers({});
      refreshUsers();
    } catch (error) {
      logger.error("Failed to save user roles", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUserProfile = async (
    uid: string,
    data: Partial<UserProfile>,
  ) => {
    if (!api) return;
    setIsSaving(true);
    try {
      if (data.roleId) {
        const targetUser = allUsers.find(u => u.uid === uid);
        if (targetUser) {
          const currentTargetRoleKey = getRoleKeyFromId(targetUser.roleId || "", allRoles);
          const newTargetRoleKey = getRoleKeyFromId(data.roleId, allRoles);

          const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");
          const otherOwnersActiveCount = allUsers.filter(u => u.organizationId === userProfile?.organizationId && u.uid !== uid && (u.role === 'owner' || u.role === 'Dono' || u.uid === organization?.ownerUserId)).length;

          const roleCtx = {
            isGlobalPrivilegedUser: isGlobal,
            actorSystemRole: userProfile?.systemRole,
            actorOrganizationRole: actorRoleKey,
            targetOrganizationRole: currentTargetRoleKey,
            isSelfChange: uid === currentUser?.uid,
            otherOwnersActiveCount
          };

          const checkChange = canChangeOrganizationRole(actorRoleKey, currentTargetRoleKey, newTargetRoleKey, roleCtx);
          if (!checkChange.canChange) {
            toastError(checkChange.error || "Operação de alteração de cargo não autorizada.");
            return;
          }

          // Keep text-based role state updated
          const finalRoleName = {
            owner: "owner",
            admin: "admin",
            leader: "leader",
            musician: "musician",
            viewer: "viewer"
          }[newTargetRoleKey] || newTargetRoleKey;

          data.musicscaleRole = finalRoleName;
          // IMPORTANT: Do NOT touch organizationRole (managed strictly by MillionsNest)

          // We don't need manual org-member update here because api.users.update already handles it.
          // The repository will safely apply to the member doc without polluting organizationRole.

          // Log into audits
          try {
            const auditRef = doc(collection(db, "audits"));
            await setDoc(auditRef, {
              action: "PROFILE_UPDATE_ROLE",
              targetCollection: "users",
              targetId: uid,
              details: {
                oldRole: targetUser?.role || "viewer",
                newRole: finalRoleName,
                actorRole: userProfile?.role || "viewer",
                isGlobal: isGlobal
              },
              user: {
                uid: currentUser?.uid,
                displayName: userProfile?.displayName,
                photoURL: userProfile?.photoURL
              },
              organizationId: userProfile?.organizationId,
              timestamp: serverTimestamp()
            });
          } catch (logErr) {}
        }
      }

      await api.users.update(uid, data);
      refreshUsers();
      toastSuccess("Cadastro atualizado com sucesso!");
    } catch (error) {
      logger.error("Failed to update user", error);
      toastError("Erro ao atualizar o perfil do usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === currentUser?.uid || !api) return;
    
    // Validate hierarchy before removing member
    const targetUser = allUsers.find(u => u.uid === memberId);
    if (targetUser) {
      const targetRoleKey = getRoleKeyFromId(targetUser.roleId || "", allRoles);
      const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");
      const otherOwnersActiveCount = allUsers.filter(u => u.organizationId === userProfile?.organizationId && u.uid !== memberId && (u.role === 'owner' || u.role === 'Dono' || u.uid === organization?.ownerUserId)).length;
      
      const roleCtx = {
        isGlobalPrivilegedUser: isGlobal,
        actorSystemRole: userProfile?.systemRole,
        actorOrganizationRole: actorRoleKey,
        targetOrganizationRole: targetRoleKey,
        isSelfChange: memberId === currentUser?.uid,
        otherOwnersActiveCount
      };

      const checkChange = canChangeOrganizationRole(actorRoleKey, targetRoleKey, "viewer", roleCtx);
      if (!checkChange.canChange) {
        toastError(checkChange.error || "Você não tem autorização para remover este usuário.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const orgId = userProfile?.organizationId || currentUser?.uid;
      try {
          // Official Source of Truth delete
          await deleteDoc(doc(db, "organizations", orgId, "members", memberId));
          
          // Legacy deletes
          const docRef1 = doc(db, "organization_members", `${memberId}_${orgId}`);
          await deleteDoc(docRef1);
      } catch (e) {}
      try {
          const docRef2 = doc(db, "organization_members", `${orgId}_${memberId}`);
          await deleteDoc(docRef2);
      } catch (e) {}
      
      setUsers((prev) => prev.filter((u) => u.uid !== memberId));
      if (allUsers) {
         // Should realistically refresh all users, but refreshUsers handles it.
         refreshUsers();
      }
      toastSuccess("Membro removido da organização.");
    } catch (error) {
      logger.error("Failed to remove user", error);
      toastError("Erro ao remover o usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    handleRemoveMember(uid);
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedUserIds([]);
  };

  const handleUserSelect = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const handleAddUsers = async (uids: string[]) => {
    if (!api) return;
    setIsSaving(true);
    try {
      const newTargetRoleKey = getRoleKeyFromId(role.id, allRoles);
      const finalRoleName = {
            owner: "owner",
            admin: "admin",
            leader: "leader",
            musician: "musician",
            viewer: "viewer"
      }[newTargetRoleKey] || newTargetRoleKey;
      await api.users.updateMany(uids, { roleId: role.id, musicscaleRole: finalRoleName });
      refreshUsers();
      setIsAddModalOpen(false);
    } catch (error) {
      logger.error("Failed to add users", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkActionConfirm = async () => {
    if (!bulkAction || selectedUserIds.length === 0 || !api) return;
    setIsSaving(true);
    try {
      if (bulkAction === "delete") {
        await Promise.all(selectedUserIds.map((uid) => {
            const orgId = userProfile?.organizationId || currentUser?.uid;
            return Promise.all([
               deleteDoc(doc(db, "organizations", orgId, "members", uid)).catch(e => null),
               deleteDoc(doc(db, "organization_members", `${uid}_${orgId}`)).catch(e => null),
               deleteDoc(doc(db, "organization_members", `${orgId}_${uid}`)).catch(e => null)
            ]);
        }));
      } else if (bulkAction === "changeRole" && newRoleId) {
        await Promise.all(selectedUserIds.map((uid) => handleUpdateMemberRole(uid, newRoleId)));
      }
      refreshUsers();
      setIsSelectionMode(false);
      setSelectedUserIds([]);
    } catch (error) {
      logger.error("Bulk action failed", error);
    } finally {
      setIsSaving(false);
      setBulkAction(null);
      setNewRoleId("");
    }
  };

  const hasChanges = Object.keys(changedUsers).length > 0;
  const roleStyle = getRoleStyle(role.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Button
          onClick={onBack}
          variant="secondary"
          size="md"
          leftIcon={<ArrowLeftIcon className="w-5 h-5" />}
        >
          {t("users.back", "Voltar")}
        </Button>
        {isSelectionMode ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleToggleSelectionMode}>
              {t("common.cancel_btn", "Cancelar")}
            </Button>
            <Button
              onClick={() => setBulkAction("changeRole")}
              disabled={selectedUserIds.length === 0}
            >
              {t("users.change_role", "Alterar Função")}
            </Button>
            <Button
              variant="danger"
              onClick={() => setBulkAction("delete")}
              disabled={selectedUserIds.length === 0}
            >
              {t("users.delete_bulk", "Excluir ({{count}})", { count: selectedUserIds.length })}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? <Spinner size="sm" /> : t("common.save_changes", "Salvar Alterações")}
              </Button>
            )}
            <Button onClick={handleToggleSelectionMode} variant="secondary">
              {t("users.select", "Selecionar")}
            </Button>
            <Button
              onClick={
                isOverLimit
                  ? () => setShowLimitModal(true)
                  : () => setIsAddModalOpen(true)
              }
              leftIcon={isOverLimit ? <Lock className="w-4 h-4 text-amber-500" /> : <UserPlusIcon className="w-4 h-4" />}
              variant={isOverLimit ? "secondary" : "primary"}
            >
              {t("users.add_user", "Adicionar Usuário")}
            </Button>
          </div>
        )}
      </div>
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          {React.createElement(roleStyle.icon, {
            className: "w-8 h-8 text-primary dark:text-primary-light",
          })}
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {t("users.managing_role", "Gerenciando: {{name}}", { name: role.name })}
            </h2>
            <p className="text-slate-500 dark:text-gray-400">
              {role.description}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {users.length > 0 ? (
            users.map((user) => (
              <div
                key={user.uid}
                onClick={() =>
                  isSelectionMode
                     ? handleUserSelect(user.uid)
                     : setSelectedUserForDetail(user)
                }
                className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-[1.5rem] transition-all duration-300 cursor-pointer group ${selectedUserIds.includes(user.uid) ? "bg-primary/20 ring-2 ring-primary border-transparent" : "bg-surface border border-slate-200/60 dark:border-white/5 hover:shadow-apple-hover"}`}
              >
                <div className="flex items-center gap-4 mb-4 sm:mb-0 w-full">
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.uid)}
                      readOnly
                      className="h-5 w-5 rounded bg-slate-200 dark:bg-gray-700 border-slate-300 dark:border-gray-600 text-primary focus:ring-primary-dark"
                    />
                  )}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center border-2 border-transparent group-hover:border-primary/20 transition-all">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-6 h-6" />
                    )}
                  </div>
                  {/* Container de Infos do Membro */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white truncate flex items-center flex-wrap gap-1">
                      {user.displayName || t("profile.user", "Usuário")} {user.uid === currentUser?.uid && <span className="text-slate-400 font-normal">{t("profile.you_label", "(Você)")}</span>}
                      
                      {/* Tag Visual do Cargo */}
                      {(() => {
                        const displayRole = getPrimaryDisplayRole(user, organization);
                        const tagStyleClass = getRoleBadgeStyles(displayRole.badgeVariant);

                        return (
                          <span className={`ml-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tagStyleClass}`}>
                            {displayRole.label}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-gray-400 break-all mt-0.5">{user.email}</span>
                  </div>
                </div>
                {!isSelectionMode && (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                      <Tag className="!bg-primary/10 !text-primary !text-[10px] font-bold uppercase">
                        {t("users.view_details", "Ver Detalhes")}
                      </Tag>
                    </div>

                    {/* Ações / Options */}
                    {user.uid !== currentUser?.uid && canEditRoles && (() => {
                      const targetRoleKey = getRoleKeyFromId(user.roleId || "", allRoles);
                      const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");
                      const otherOwnersActiveCount = (allUsers || users).filter(u => u.organizationId === userProfile?.organizationId && u.uid !== user.uid && (u.role === 'owner' || u.role === 'Dono' || u.uid === organization?.ownerUserId)).length;

                      const roleCtx = {
                        isGlobalPrivilegedUser: isGlobal,
                        actorSystemRole: userProfile?.systemRole,
                        actorOrganizationRole: actorRoleKey,
                        targetOrganizationRole: targetRoleKey,
                        isSelfChange: false,
                        otherOwnersActiveCount
                      };

                      const checkChange = canChangeOrganizationRole(actorRoleKey, targetRoleKey, targetRoleKey, roleCtx);
                      const isEditable = checkChange.canChange;

                      if (!isEditable) {
                        return (
                          <div className="text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1">
                            {t("users.read_only", "Apenas Leitura")}
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center gap-3">
                          <select
                            value={getRoleKeyFromId(user.roleId || "", allRoles)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleUpdateMemberRole(user.uid, e.target.value)
                            }
                            className="bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10 text-slate-700 dark:text-[#F5F7FA] text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 dark:focus:border-blue-500 cursor-pointer"
                          >
                            <option value="owner">{t("roles.owner", "Dono")}</option>
                            <option value="admin">{t("roles.admin", "Administrador")}</option>
                            <option value="leader">{t("roles.leader", "Líder / Ministro")}</option>
                            <option value="musician">{t("roles.musician", "Músico / Vocal")}</option>
                            <option value="viewer">{t("roles.viewer", "Visitante")}</option>
                          </select>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (window.confirm(t("users.remove_confirm", "Deseja realmente remover este usuário da equipe?"))) {
                                handleDeleteUser(user.uid);
                              }
                            }} 
                            className="text-xs text-red-500 hover:text-red-400 font-medium whitespace-nowrap"
                          >
                            {t("users.delete", "Excluir")}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-slate-500 dark:text-gray-400 py-8">
              {t("users.no_users_found", "Nenhum usuário encontrado nesta função.")}
            </p>
          )}
        </div>
      </Card>

      {/* Modal de Detalhes do Usuário */}
      <UserDetailsModal
        isOpen={!!selectedUserForDetail}
        user={selectedUserForDetail}
        roles={allRoles}
        instruments={instruments}
        onClose={() => setSelectedUserForDetail(null)}
        onSave={handleUpdateUserProfile}
        onDelete={handleDeleteUser}
        isSubmitting={isSaving}
        allUsers={allUsers || users}
      />

      <ConfirmationModal
        isOpen={bulkAction === "delete"}
        onClose={() => setBulkAction(null)}
        onConfirm={handleBulkActionConfirm}
        title={t("users.bulk_delete_title", "Excluir {{count}} Usuários", { count: selectedUserIds.length })}
        message={t("users.bulk_delete_desc", "Tem certeza que deseja excluir os {{count}} usuários selecionados? Esta ação removerá apenas o perfil do banco de dados.", { count: selectedUserIds.length })}
        isLoading={isSaving}
      />
      <Modal
        isOpen={bulkAction === "changeRole"}
        onClose={() => setBulkAction(null)}
        title={t("users.bulk_role_title", "Alterar Função de {{count}} Usuários", { count: selectedUserIds.length })}
      >
        <div className="space-y-4">
          <p>{t("users.bulk_role_desc", "Selecione a nova função para os usuários selecionados.")}</p>
          <select
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
            className="input-base"
          >
            <option value="" disabled>
              {t("users.select_role_placeholder", "Selecione uma função...")}
            </option>
            {sortedAllRoles
              .filter((r) => r.id !== role.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <Button
            onClick={handleBulkActionConfirm}
            disabled={isSaving || !newRoleId}
          >
            {isSaving ? <Spinner size="sm" /> : t("users.confirm_role_change", "Confirmar Alteração")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setBulkAction(null)}
            className="mt-3 w-full sm:mt-0 sm:w-auto"
          >
            {t("common.cancel_btn", "Cancelar")}
          </Button>
        </div>
      </Modal>
      <AddUsersToRoleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        role={role}
        allUsers={allUsers}
        onAdd={handleAddUsers}
      />
      <UpgradePlanModal 
        isOpen={showLimitModal} 
        onClose={() => setShowLimitModal(false)}
        featureKey={"usersLimit" as any} 
      />
    </div>
  );
};

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser, userProfile, organization } = useAuth();
  const { roles, instruments } = useMusic();
  const api = useApi();
  const { hasCapability } = useCapability();
  const { success: toastSuccess } = useToast();
  const managementSectionRef = useRef<HTMLDivElement>(null);
  
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const isGlobal = isGlobalPrivilegedUser(currentUser, userProfile);
  const [migrating, setMigrating] = useState(false);

  const [isExistingMemberSetupOpen, setIsExistingMemberSetupOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const [intentHandled, setIntentHandled] = useState(false);
  const [showContextualGuide, setShowContextualGuide] = useState(false);
  const [returnToPath, setReturnToPath] = useState<string | null>(null);

  const resolveAccessPolicy = (member: UserProfile): TeamMemberAccessPolicy => {
    const isCurrentUser = member.uid === currentUser?.uid;
    const isMemberOwner = member.uid === organization?.ownerUserId || getRoleKeyFromId(member.roleId || "", roles) === "owner" || member.role === "Dono";
    
    const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");
    const currentTargetRoleKey = getRoleKeyFromId(member.roleId || "", roles);
    
    const otherOwnersActiveCount = allUsers.filter(u => u.organizationId === userProfile?.organizationId && u.uid !== member.uid && (getRoleKeyFromId(u.roleId || "", roles) === 'owner' || u.role === 'Dono' || u.uid === organization?.ownerUserId)).length;

    const roleCtx = {
      isGlobalPrivilegedUser: isGlobal,
      actorSystemRole: userProfile?.systemRole,
      actorOrganizationRole: actorRoleKey,
      targetOrganizationRole: currentTargetRoleKey,
      isSelfChange: false,
      otherOwnersActiveCount
    };

    const changeDecision = canChangeOrganizationRole(actorRoleKey, currentTargetRoleKey, currentTargetRoleKey, roleCtx);
    const canEditByHierarchy = changeDecision.canChange;

    let canEditAccess = true;
    let lockReason: "owner" | "self" | "hierarchy" | null = null;
    let reason = '';

    if (isCurrentUser) {
      canEditAccess = false;
      lockReason = "self";
      reason = t('teamSetup.existingMember.access.currentUserExplanation');
    } else if (isMemberOwner) {
      canEditAccess = false;
      lockReason = "owner";
      reason = t('teamSetup.existingMember.access.ownerExplanation');
    } else if (!canEditByHierarchy) {
      canEditAccess = false;
      lockReason = "hierarchy";
      reason = changeDecision.error || t('roles.cannot_manage_role');
    } else {
      lockReason = null;
    }

    const allowedRoleIds = roles.filter(r => {
      const targetRoleKey = getRoleKeyFromId(r.id, roles);
      if (targetRoleKey === 'owner' || r.name === 'Dono' || r.name === 'Owner' || r.name === 'CEO') return false;
      
      const assignCtx = {
        ...roleCtx,
        newOrganizationRole: targetRoleKey
      };
      
      const assignDecision = canAssignOrganizationRole(actorRoleKey, targetRoleKey, assignCtx);
      return assignDecision.canAssign;
    }).map(r => r.id);

    return {
      canEditAccess,
      lockReason,
      reason,
      allowedRoleIds
    };
  };

  const handleSaveTeamSetup = async (draft: TeamMemberSetupDraft) => {
    const member = allUsers.find(u => u.uid === draft.userId);
    if (!member) throw new Error("Membro não encontrado");

    if (draft.roleId && draft.roleId !== member.roleId) {
      const policy = resolveAccessPolicy(member);
      const isRoleAllowed = policy.allowedRoleIds.includes(draft.roleId);
      const isTryingToAssignOwner = getRoleKeyFromId(draft.roleId, roles) === "owner";

      if (!policy.canEditAccess || policy.lockReason !== null || !isRoleAllowed || isTryingToAssignOwner) {
        throw new Error("TEAM_ACCESS_POLICY_CHANGED");
      }
    }

    const specialtyIds = normalizeSpecialtyIds(draft.specialtyIds || []);
    const payload: TeamMemberSetupPayload = { specialtyIds };

    if (draft.roleId && draft.roleId !== member.roleId) {
      payload.roleId = draft.roleId;
      payload.musicscaleRole = getRoleKeyFromId(draft.roleId, roles);
    }

    await api.users.update(draft.userId, payload);
    await fetchUsers();
    toastSuccess(t('teamSetup.existingMember.successToast'));
  };


  const fetchJoinRequests = async () => {
    if (!userProfile?.organizationId) return;
    try {
      const q = query(
        collection(db, 'organization_join_requests'), 
        where('organizationId', '==', userProfile.organizationId)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setJoinRequests(docs.filter(d => (d as any).status === 'pending'));
    } catch (e) {
      logger.error("Failed to load join requests", e);
    }
  };

  const handleProcessRequest = async (req: any, approve: boolean) => {
     try {
        if (approve) {
           // 1. Official Members Subcollection
           const targetMemberRef = doc(db, 'organizations', req.organizationId, 'members', req.uid);
           await setDoc(targetMemberRef, {
              uid: req.uid,
              organizationId: req.organizationId,
              organizationRole: 'member',
              musicscaleRole: 'member',
              role: 'member',
              status: 'active',
              joinedAt: serverTimestamp(),
              source: 'join_request',
              apps: { musicscale: { access: true, status: "active" } }
           }, { merge: true });

           // 2. Legacy fallback
           const memberRef = doc(db, 'organization_members', `${req.organizationId}_${req.uid}`);
           await setDoc(memberRef, {
              user_id: req.uid,
              uid: req.uid,
              organization_id: req.organizationId,
              organizationId: req.organizationId,
              role: 'member',
              created_at: serverTimestamp(),
              joinedAt: serverTimestamp()
           });

           await updateDoc(doc(db, 'users', req.uid), {
              organizationId: req.organizationId
           });
           await deleteDoc(doc(db, 'organization_join_requests', req.id));
        } else {
           await updateDoc(doc(db, 'organization_join_requests', req.id), { status: 'denied' });
        }
        await fetchJoinRequests();
        await fetchUsers();
     } catch (e) {
        logger.error("Failed to process request", e);
        alert("Erro ao processar solicitação.");
     }
  };

  const fetchUsers = async () => {
    if (!api) return;
    if (!selectedRole) setLoading(true);
    try {
      const userProfiles = await api.users.list();
      const normalizedProfiles = userProfiles.map(u => {
          const roleSourceStr = u.musicscaleRole || u.ministryFunction || u.organizationRole || u.roleId || u.role || 'viewer';
          
          let match = roles.find(r => r.id === roleSourceStr);
          if (!match) {
             const mappedKey = getRoleKeyFromName(roleSourceStr || "");
             if (mappedKey === 'owner') match = roles.find(r => r.name === 'Dono');
             else if (mappedKey === 'admin') match = roles.find(r => r.name === 'Administrador');
             else if (mappedKey === 'leader') match = roles.find(r => r.name === 'Líder' || r.name === 'Ministro' || r.name === 'Líder / Ministro');
             else if (mappedKey === 'musician') match = roles.find(r => r.name === 'Músico' || r.name === 'Vocal' || r.name === 'Músico / Vocal');
             else match = roles.find(r => r.name === 'Visitante');
          }
          
          let resolvedRoleId = match ? match.id : u.roleId;
          return { ...u, roleId: resolvedRoleId };
      });
      setAllUsers(normalizedProfiles);
    } catch (err) {
      setError(t("users.load_err", "Falha ao carregar os usuários."));
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.organizationId && roles.length > 0) {
      fetchUsers();
      fetchJoinRequests();
    }
  }, [userProfile?.organizationId, roles.length]);

  const userCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    roles.forEach((role) => {
      counts[role.id] = 0;
    });
    allUsers.forEach((user) => {
      if (user.roleId && user.roleId in counts) {
        counts[user.roleId]++;
      }
    });
    return counts;
  }, [allUsers, roles]);

  const sortedRoles = useMemo(() => sortRolesByHierarchy(roles), [roles]);

  const teamSetupSummary = useMemo(
    () => evaluateTeamSetup(allUsers, currentUser?.uid),
    [allUsers, currentUser?.uid]
  );
  
  const canManageTeamSetup = hasCapability("musicscale.members.manage");

  useEffect(() => {
    const state = location.state as any;
    if (state?.teamSetupIntent && !intentHandled && !loading && canManageTeamSetup && roles.length > 0) {
      if (state.teamSetupIntent === 'configure-existing') {
        setIsExistingMemberSetupOpen(true);
      } else if (state.teamSetupIntent === 'add-members') {
        setShowContextualGuide(true);
        if (state.returnTo && state.returnTo.startsWith('/')) {
          setReturnToPath(state.returnTo);
        }
        
        setTimeout(() => {
          const section = managementSectionRef.current;
          if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
            section.focus({ preventScroll: true });
          }
        }, 100);
      }
      setIntentHandled(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, intentHandled, loading, canManageTeamSetup, roles.length, navigate]);

  const handleReviewTeamSetup = () => {
    const section = managementSectionRef.current;
    if (!section) return;
    section.scrollIntoView?.({
      behavior: "smooth",
      block: "start"
    });
    section.focus({
      preventScroll: true
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  if (selectedRole) {
    return (
      <UserManagementView
        role={selectedRole}
        initialUsers={allUsers.filter((u) => u.roleId === selectedRole.id)}
        allUsers={allUsers}
        allRoles={roles}
        instruments={instruments}
        onBack={() => setSelectedRole(null)}
        refreshUsers={fetchUsers}
      />
    );
  }

  const handleMigrateRoles = async () => {
    if (!api || !userProfile?.organizationId) return;
    if (!window.confirm("Essa operação irá separar os campos de Cargo Organizacional e Função Ministerial para todos os usuários desta organização preservando a compatibilidade. Deseja continuar?")) return;
    setMigrating(true);
    try {
      const db = (await import('../services/firebase')).db;
      const { collection, getDocs, writeBatch, doc } = await import('firebase/firestore');
      
      const membersSnap = await getDocs(query(collection(db, 'organization_members'), where('organizationId', '==', userProfile.organizationId)));
      const membersSnapLeg = await getDocs(query(collection(db, 'organization_members'), where('organization_id', '==', userProfile.organizationId)));
      
      const batch = writeBatch(db);
      let count = 0;
      
      const processDoc = (d: any) => {
         const data = d.data();
         if (!data.organizationRole && data.role) {
             const updates: any = {};
             // Migrate role -> organizationRole and musicscaleRole
             const r = typeof data.role === 'string' ? data.role.toLowerCase() : '';
             
             updates.organizationRole = r.includes('dono') || r.includes('owner') ? 'owner' 
               : r.includes('admin') ? 'admin' 
               : r.includes('lider') || r.includes('líder') ? 'leader' 
               : r.includes('visit') ? 'visitor' : 'member';

             updates.musicscaleRole = r.includes('dono') || r.includes('owner') || r.includes('admin') ? 'admin'
               : r.includes('lider') || r.includes('líder') ? 'leader'
               : r.includes('visit') ? 'viewer' : 'member';

             // If the legacy role sounds like a ministry function, assign it
             if (r.includes('músico') || r.includes('musico') || r.includes('vocal')) {
                 updates.ministryFunction = r.includes('vocal') ? 'vocal' : 'musician';
             }

             batch.update(doc(db, 'organization_members', d.id), updates);
             count++;
         }
      };

      membersSnap.docs.forEach(processDoc);
      membersSnapLeg.docs.forEach(processDoc);
      
      if (count > 0) {
          await batch.commit();
          alert(`Migração concluída! ${count} registros populados com a nova estrutura separada.`);
          fetchUsers();
      } else {
          alert('A organização já estava com os papéis atualizados (Nenhum registro antigo encontrado).');
      }
    } catch (e) {
      console.error(e);
      alert("Erro na migração.");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-8">

      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {t("users.management_title", "Equipe e Permissões")}
          </h1>
          {isGlobal && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMigrateRoles}
              disabled={migrating}
            >
              {migrating ? <Spinner size="sm" /> : "Migrar Estrutura de Papéis (Admin)"}
            </Button>
          )}
        </div>
        <UserUsageBanner />
      </div>

      {!loading && canManageTeamSetup && (
        <TeamSetupProgressCard
          summary={teamSetupSummary}
          onReview={handleReviewTeamSetup}
          onConfigure={() => setIsExistingMemberSetupOpen(true)}
        />
      )}
      

      {joinRequests.length > 0 && (
        <Card padding="none" className="overflow-hidden mb-8 border-amber-200 dark:border-amber-900/50">
          <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/50">
             <h3 className="text-amber-800 dark:text-amber-500 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Solicitações Pendentes
             </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
             {joinRequests.map(req => (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                      {req.photoURL ? (
                         <img src={req.photoURL} alt="Avatar" className="w-10 h-10 rounded-full" />
                      ) : (
                         <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center text-slate-500">
                            <UserIcon className="w-5 h-5" />
                         </div>
                      )}
                      <div>
                         <p className="font-semibold text-slate-800 dark:text-white">{req.displayName || "Usuário"}</p>
                         <p className="text-sm text-slate-500">{req.email}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => handleProcessRequest(req, false)} size="sm">
                         Negar
                      </Button>
                      <Button onClick={() => handleProcessRequest(req, true)} size="sm">
                         Aprovar
                      </Button>
                   </div>
                </div>
             ))}
          </div>
        </Card>
      )}

      {canManageTeamSetup && !loading && isExistingMemberSetupOpen && (
        <ExistingMemberSetupGuide
          isOpen={isExistingMemberSetupOpen}
          resolveRoleKey={(roleId) => getRoleKeyFromId(roleId, roles)}
          members={allUsers}
          roles={roles}
          instruments={instruments}
          currentUserId={currentUser?.uid}
          resolveAccessPolicy={resolveAccessPolicy}
          onClose={() => setIsExistingMemberSetupOpen(false)}
          onSave={handleSaveTeamSetup}
        />
      )}


      <div
        ref={managementSectionRef}
        tabIndex={-1}
        aria-label={t("teamSetup.progress.sectionLabel")}
        className="outline-none"
      >
        {showContextualGuide && (
          <div className="mb-6 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
            <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-2">
              {t('firstValueJourney.guideTitle', 'Adicionar pessoas à equipe')}
            </h3>
            <p className="text-sm text-indigo-600 dark:text-indigo-300 mb-4 whitespace-pre-line">
              {t('firstValueJourney.guideDescription', '1. Escolha uma função abaixo.\n2. Adicione ou convide uma pessoa.')}
            </p>
            {returnToPath && (
              <Button onClick={() => navigate(returnToPath)} variant="default">
                {t('firstValueJourney.returnToDashboard', 'Voltar para o painel')}
              </Button>
            )}
          </div>
        )}

        <p className="text-slate-500 dark:text-gray-400 mb-4">
          {t("users.management_subtitle", "Clique em uma função para gerenciar os usuários associados.")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedRoles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            count={userCounts[role.id] || 0}
            onSelect={setSelectedRole}
          />
        ))}
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
