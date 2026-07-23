import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { UserProfile, Role, Instrument } from "../../types";
import Button from "../common/Button";
import Card from "../common/Card";
import { evaluateTeamSetup, groupMinistryFunctions } from "../../utils/teamSetup";
import { AccessProfileSelector } from "./AccessProfileSelector";
import { MinistryFunctionSelector } from "./MinistryFunctionSelector";
import { TeamMemberReview } from "./TeamMemberReview";
import { InviteMemberModal } from "../../pages/UsersPage";
import { useAuth } from "../../contexts/AuthContext";
import { useEcosystem } from "../../contexts/EcosystemContext";
import { getRoleKeyFromId, getRoleKeyFromName, canChangeOrganizationRole } from "../../utils/roleHierarchy";
import { useApi } from "../../contexts/ApiContext";
import { useToast } from "../../contexts/ToastContext";
import Spinner from "../common/Spinner";
import { ArrowLeft, UserPlus, CheckCircle2, ChevronRight, Check } from "lucide-react";
import { UpgradePlanModal } from "../premium/EntitlementGates";

interface TeamSetupGuideProps {
  users: UserProfile[];
  roles: Role[];
  instruments: Instrument[];
  isOverLimit: boolean;
  onRefreshUsers: () => void;
  onClose: () => void;
}

type SetupStep = 1 | 2 | 3 | 4 | 5;

export const TeamSetupGuide: React.FC<TeamSetupGuideProps> = ({
  users,
  roles,
  instruments,
  isOverLimit,
  onRefreshUsers,
  onClose,
}) => {
  const { t } = useTranslation();
  const { user: currentUser, userProfile } = useAuth();
  const { isGlobal } = useEcosystem();
  const api = useApi();
  const { error: toastError, success: toastSuccess } = useToast();
  const [, setSearchParams] = useSearchParams();
  
  const [step, setStep] = useState<SetupStep>(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // Temporary state for the setup
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<string[]>([]);
  const [deferFunctions, setDeferFunctions] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState<string | null>(null);

  const summary = evaluateTeamSetup(users, currentUser?.uid);
  const functionGroups = groupMinistryFunctions(instruments);

  const handleClose = () => {
    // Confirm if there are unsaved changes
    if (step > 2 && step < 5) {
      if (!window.confirm("Você tem alterações não salvas. Deseja realmente sair?")) {
        return;
      }
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("setup");
      return next;
    });
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showInviteModal && !showLimitModal) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, showInviteModal, showLimitModal]);

  const advanceStep = () => setStep(s => Math.min(s + 1, 5) as SetupStep);
  const previousStep = () => setStep(s => Math.max(s - 1, 1) as SetupStep);

  const getSortedUsers = () => {
    const validUsers = users.filter(u => u.uid);
    const incomplete = validUsers.filter(u => summary.incompleteMemberIds.includes(u.uid));
    const complete = validUsers.filter(u => !summary.incompleteMemberIds.includes(u.uid));
    return [...incomplete, ...complete];
  };

  const handleUserSelect = (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return;
    
    setSelectedUserId(uid);
    setSelectedRoleId(user.roleId || null);
    setSelectedSpecialtyIds(user.specialtyIds || []);
    setDeferFunctions(false);
    advanceStep();
  };

  const handleRoleSelect = (roleId: string) => {
    setSelectedRoleId(roleId);
  };

  const toggleFunction = (id: string) => {
    setDeferFunctions(false);
    setSelectedSpecialtyIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const canSave = () => {
    if (!selectedRoleId) return false;
    if (!deferFunctions && selectedSpecialtyIds.length === 0) return false;
    return true;
  };

  const handleSave = async () => {
    if (!selectedUserId || !selectedRoleId || !api) return;

    const targetUser = users.find(u => u.uid === selectedUserId);
    if (!targetUser) return;

    // Check permissions if modifying someone else or even oneself for role
    const newTargetRoleKey = getRoleKeyFromId(selectedRoleId, roles);
    const oldTargetRoleKey = getRoleKeyFromId(targetUser.roleId || "", roles);
    const actorRoleKey = isGlobal ? "owner" : getRoleKeyFromName(userProfile?.role || "");

    const roleCtx = {
      isGlobalPrivilegedUser: isGlobal,
      actorSystemRole: userProfile?.systemRole,
      actorOrganizationRole: actorRoleKey,
      targetOrganizationRole: oldTargetRoleKey,
      isSelfChange: targetUser.uid === currentUser?.uid,
      otherOwnersActiveCount: users.filter(u => u.uid !== targetUser.uid && (u.role === 'owner' || u.role === 'Dono' || u.musicscaleRole === 'owner')).length
    };

    if (targetUser.uid === currentUser?.uid && oldTargetRoleKey !== newTargetRoleKey) {
        toastError(t("teamSetup.errors.cannotChangeSelfAccess", "Você não pode alterar seu próprio perfil de acesso."));
        return;
    }

    if (targetUser.uid !== currentUser?.uid && oldTargetRoleKey !== newTargetRoleKey) {
        const checkChange = canChangeOrganizationRole(actorRoleKey, oldTargetRoleKey, newTargetRoleKey, roleCtx);
        if (!checkChange.canChange) {
            toastError(checkChange.error || t("teamSetup.errors.saveFailed", "Erro ao salvar a configuração."));
            return;
        }
    }

    setIsSaving(true);
    try {
      const finalRoleName = {
        owner: "owner",
        admin: "admin",
        leader: "leader",
        musician: "musician",
        viewer: "viewer"
      }[newTargetRoleKey] || newTargetRoleKey;

      const updatePayload: any = {
        specialtyIds: selectedSpecialtyIds
      };

      if (oldTargetRoleKey !== newTargetRoleKey || !targetUser.musicscaleRole) {
          updatePayload.roleId = selectedRoleId;
          updatePayload.musicscaleRole = finalRoleName;
      }

      await api.users.update(targetUser.uid, updatePayload);
      onRefreshUsers();
      toastSuccess(t("common.saved", "Salvo com sucesso"));
      advanceStep();
    } catch (error) {
      toastError(t("teamSetup.errors.saveFailed", "Erro ao salvar a configuração."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteStart = () => {
    if (isOverLimit) {
      setShowLimitModal(true);
    } else {
      setSelectedRoleId(null);
      setStep(7 as any); // Special step for choosing invite profile
    }
  };

  const openInviteModalWithRole = () => {
    setInviteRoleId(selectedRoleId);
    setShowInviteModal(true);
    setStep(2); // Go back to choose person after invite is created
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col overflow-hidden" role="dialog" aria-modal="true">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
        <Button variant="ghost" onClick={handleClose} leftIcon={<ArrowLeft className="w-5 h-5" />}>
          {t("teamSetup.steps.back", "Voltar")}
        </Button>
        <div className="text-sm font-medium text-slate-500">
          {step <= 5 ? t("teamSetup.steps.stepIndicator", `Etapa ${step} de 5`, { current: step, total: 5 }) : ""}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-2xl" aria-live="polite">
          
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-6">
                {t("teamSetup.progress.title", "Configure sua equipe")}
              </h2>
              
              <div className="space-y-4">
                <Card className="p-6 border-slate-200 dark:border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {t("teamSetup.understand.title1", "Vínculo com a organização")}
                    </h3>
                    <span className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">
                      {t("teamSetup.understand.badge1", "Administrado pela MillionsNest")}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {t("teamSetup.understand.text1", "Define de qual organização a pessoa faz parte. Essa configuração vem da MillionsNest.")}
                  </p>
                </Card>

                <Card className="p-6 border-slate-200 dark:border-white/10">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                    {t("teamSetup.understand.title2", "Perfil de acesso")}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-2">
                    {t("teamSetup.understand.text2", "Define o que a pessoa poderá fazer dentro do MusicScale.")}
                  </p>
                  <p className="text-sm text-slate-500 italic">
                    Ex: {t("teamSetup.understand.example2", "Criar escalas, organizar repertório ou apenas consultar compromissos.")}
                  </p>
                </Card>

                <Card className="p-6 border-slate-200 dark:border-white/10">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                    {t("teamSetup.understand.title3", "Funções na equipe")}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-2">
                    {t("teamSetup.understand.text3", "Define como a pessoa poderá participar das escalas.")}
                  </p>
                  <p className="text-sm text-slate-500 italic">
                    Ex: {t("teamSetup.understand.example3", "Vocal, teclado, bateria, som ou ministro.")}
                  </p>
                </Card>
              </div>

              <div className="pt-6">
                <Button size="lg" className="w-full md:w-auto" onClick={advanceStep}>
                  {t("teamSetup.understand.action", "Começar configuração")}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {t("teamSetup.steps.choosePerson", "ESCOLHER PESSOA")}
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Button variant="outline" onClick={handleInviteStart} leftIcon={<UserPlus className="w-4 h-4" />}>
                  {t("teamSetup.invite.action", "Convidar nova pessoa")}
                </Button>
              </div>

              <div className="space-y-3">
                {getSortedUsers().map(user => {
                  const hasAccess = !!(user.roleId || user.musicscaleRole);
                  const hasFunctions = Array.isArray(user.specialtyIds) && user.specialtyIds.some(id => !!id);
                  const isComplete = hasAccess && hasFunctions;
                  
                  return (
                    <button
                      key={user.uid}
                      onClick={() => handleUserSelect(user.uid)}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                            {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{user.displayName || user.email}</p>
                          {user.displayName && <p className="text-sm text-slate-500">{user.email}</p>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right ml-4">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            {t("teamSetup.choose.completeStatus", "Configuração completa")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
                            {!hasAccess 
                              ? t("teamSetup.choose.missingAccess", "Falta perfil de acesso")
                              : t("teamSetup.choose.missingFunctions", "Falta função na equipe")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2" tabIndex={-1} autoFocus>
                {t("teamSetup.access.title", "O que esta pessoa poderá fazer no MusicScale?")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8">
                {t("teamSetup.access.description", "Escolha o que essa pessoa poderá fazer.")}
              </p>
              
              <AccessProfileSelector 
                roles={roles} 
                selectedRoleId={selectedRoleId} 
                onSelect={handleRoleSelect} 
              />

              <div className="pt-6 flex justify-between">
                <Button variant="ghost" onClick={previousStep}>
                  {t("teamSetup.steps.back", "Voltar")}
                </Button>
                <Button onClick={advanceStep} disabled={!selectedRoleId}>
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2" tabIndex={-1} autoFocus>
                {t("teamSetup.functions.title", "Como esta pessoa poderá servir na equipe?")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8">
                {t("teamSetup.functions.description", "Agora escolha como ela poderá participar das escalas.")}
              </p>

              <MinistryFunctionSelector
                groups={functionGroups}
                selectedIds={selectedSpecialtyIds}
                onToggle={toggleFunction}
              />

              <div className="pt-6 flex flex-col-reverse sm:flex-row justify-between gap-4">
                <Button variant="ghost" onClick={previousStep} className="w-full sm:w-auto">
                  {t("teamSetup.steps.back", "Voltar")}
                </Button>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => { setDeferFunctions(true); advanceStep(); }} className="w-full sm:w-auto">
                    {t("teamSetup.functions.defer", "Definir depois")}
                  </Button>
                  <Button onClick={advanceStep} disabled={selectedSpecialtyIds.length === 0} className="w-full sm:w-auto">
                    Continuar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 5 && selectedUserId && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-8" tabIndex={-1} autoFocus>
                {t("teamSetup.review.title", "Está tudo certo?")}
              </h2>
              
              <TeamMemberReview
                user={users.find(u => u.uid === selectedUserId)!}
                selectedRole={roles.find(r => r.id === selectedRoleId)}
                selectedFunctions={instruments.filter(i => selectedSpecialtyIds.includes(i.id))}
                isDeferred={deferFunctions}
              />

              <div className="pt-8 flex flex-col-reverse sm:flex-row justify-between gap-4">
                <Button variant="ghost" onClick={previousStep} disabled={isSaving} className="w-full sm:w-auto">
                  {t("teamSetup.review.fix", "Voltar e corrigir")}
                </Button>
                <Button onClick={handleSave} disabled={!canSave() || isSaving} className="w-full sm:w-auto">
                  {isSaving ? <Spinner size="sm" /> : t("teamSetup.review.save", "Salvar configuração")}
                </Button>
              </div>
            </div>
          )}

          {/* Success Step (Not exactly step 6, but shown after save) */}
          {step === 6 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 text-center py-12">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4" tabIndex={-1} autoFocus>
                {t("teamSetup.completion.title", "Pessoa configurada")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-8">
                {t("teamSetup.completion.message", "Agora o MusicScale sabe o que essa pessoa pode fazer e em quais funções ela pode ser escalada.")}
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  {t("teamSetup.completion.configureNext", "Configurar próxima pessoa")}
                </Button>
                <Button onClick={handleClose}>
                  {t("teamSetup.completion.backToTeam", "Voltar para equipe")}
                </Button>
                <Button variant="secondary" onClick={() => window.location.href = '/'}>
                  {t("teamSetup.completion.goToNextEvent", "Ir para o próximo culto")}
                </Button>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2" tabIndex={-1} autoFocus>
                {t("teamSetup.access.title", "O que esta pessoa poderá fazer no MusicScale?")}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8">
                {t("teamSetup.access.description", "Escolha o que essa pessoa poderá fazer.")}
              </p>
              
              <AccessProfileSelector 
                roles={roles.filter(r => r.name !== 'Dono' && r.name !== 'Owner')} 
                selectedRoleId={selectedRoleId} 
                onSelect={handleRoleSelect} 
              />

              <div className="pt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  {t("teamSetup.steps.back", "Voltar")}
                </Button>
                <Button onClick={openInviteModalWithRole} disabled={!selectedRoleId}>
                  {t("teamSetup.invite.action", "Convidar nova pessoa")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showInviteModal && (
        <InviteMemberModal
          isOpen={true}
          onClose={() => setShowInviteModal(false)}
          role={roles.find(r => r.id === (inviteRoleId || roles[0]?.id)) || roles[0]}
        />
      )}
      
      {showLimitModal && (
        <UpgradePlanModal 
          isOpen={true} 
          onClose={() => setShowLimitModal(false)} 
        />
      )}
    </div>
  );
};
