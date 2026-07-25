import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import ConfirmationModal from '../common/ConfirmationModal';
import Button from '../common/Button';
import { UserProfile, Role, Instrument } from '../../types';
import { 
  TeamMemberAccessPolicy, 
  TeamMemberSetupDraft,
  buildExistingMemberSetupItems,
  groupTeamFunctions,
  isTeamMemberDraftDirty
} from '../../utils/teamMemberSetup';
import { AccessProfileSelector } from './AccessProfileSelector';
import { MinistryFunctionSelector } from './MinistryFunctionSelector';
import { TeamMemberReview } from './TeamMemberReview';
import { User, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';

interface ExistingMemberSetupGuideProps {
  isOpen: boolean;
  members: readonly UserProfile[];
  roles: readonly Role[];
  instruments: readonly Instrument[];
  currentUserId?: string;
  resolveAccessPolicy: (member: UserProfile) => TeamMemberAccessPolicy;
  onClose: () => void;
  onSave: (draft: TeamMemberSetupDraft) => Promise<void>;
}

type Step = 1 | 2 | 3 | 4;

export function ExistingMemberSetupGuide({
  isOpen,
  members,
  roles,
  instruments,
  currentUserId,
  resolveAccessPolicy,
  onClose,
  onSave
}: ExistingMemberSetupGuideProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Partial<TeamMemberSetupDraft>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const titleRef = useRef<HTMLHeadingElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDraft({});
      setIsSaving(false);
      setSaveError(null);
      setIsCompleted(false);
      setShowDiscardConfirm(false);
    }
  }, [isOpen]);

  // Global Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape' && !showDiscardConfirm) {
        handleCloseAttempt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDiscardConfirm, draft, step]);

  // Focus management
  useEffect(() => {
    if (isOpen && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isOpen, step, saveError]);

  const items = buildExistingMemberSetupItems(members, currentUserId);
  const groups = groupTeamFunctions(instruments);
  
  const selectedUser = members.find(m => m.uid === draft.userId);
  const isOwner = selectedUser?.organizationRole === 'owner' || selectedUser?.role === 'Dono';
  const isCurrentUser = selectedUser?.uid === currentUserId;
  const policy = selectedUser ? resolveAccessPolicy(selectedUser) : null;

  const handleCloseAttempt = () => {
    if (isCompleted || !selectedUser) {
      onClose();
      return;
    }
    const isDirty = isTeamMemberDraftDirty(
      { userId: selectedUser.uid, roleId: selectedUser.roleId || '', specialtyIds: selectedUser.specialtyIds || [] },
      draft as TeamMemberSetupDraft
    );
    if (!isDirty) {
      onClose();
    } else {
      setShowDiscardConfirm(true);
    }
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  const handlePersonSelect = (userId: string) => {
    const user = members.find(m => m.uid === userId);
    if (!user) return;
    
    // Initialize draft with existing user values
    setDraft({
      userId,
      roleId: user.roleId || '',
      specialtyIds: user.specialtyIds || []
    });
    setStep(2);
  };

  const handleAccessSelect = (roleId: string) => {
    setDraft(prev => ({ ...prev, roleId }));
  };

  const handleFunctionToggle = (id: string) => {
    setDraft(prev => {
      const current = prev.specialtyIds || [];
      if (current.includes(id)) {
        return { ...prev, specialtyIds: current.filter(x => x !== id) };
      } else {
        return { ...prev, specialtyIds: [...current, id] };
      }
    });
  };

  const handleDefineLater = () => {
    setDraft(prev => ({ ...prev, specialtyIds: [] }));
    setStep(4);
  };

  const handleSave = async () => {
    if (!draft.userId || !selectedUser || !policy) return;

    setIsSaving(true);
    setSaveError(null);

    // Revalidate policy
    const freshPolicy = resolveAccessPolicy(selectedUser);
    
    // Check if access changed and needs revalidation
    if (draft.roleId !== selectedUser.roleId) {
      if (!freshPolicy.canEditAccess || !freshPolicy.allowedRoleIds.includes(draft.roleId || '')) {
        setSaveError(t('teamSetup.existingMember.errors.policyChanged'));
        setIsSaving(false);
        return;
      }
      
      const roleObj = roles.find(r => r.id === draft.roleId);
      if (roleObj?.name?.toLowerCase() === 'owner' || roleObj?.name?.toLowerCase() === 'dono' || roleObj?.name?.toLowerCase() === 'ceo') {
        setSaveError(t('teamSetup.existingMember.errors.policyChanged'));
        setIsSaving(false);
        return;
      }
    }

    try {
      await onSave({
        userId: draft.userId,
        roleId: draft.roleId || '',
        specialtyIds: draft.specialtyIds || []
      });
      setIsCompleted(true);
    } catch (error: unknown) {
      console.error(error);
      const e = error as Error;
      if (e.message === "TEAM_ACCESS_POLICY_CHANGED") {
         setSaveError(t('teamSetup.existingMember.errors.policyChanged', 'A política de acesso mudou.'));
      } else {
         setSaveError(t('teamSetup.existingMember.errors.saveFailed', 'Falha ao salvar.'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextPerson = () => {
    setStep(1);
    setDraft({});
    setIsCompleted(false);
    setSaveError(null);
  };

  const renderStepIndicator = () => (
    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2" aria-current="step">
      {t('teamSetup.existingMember.steps.stepIndicator', { current: step, total: 4 })}
    </p>
  );

  const renderStep1 = () => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <h2 tabIndex={-1} ref={titleRef} className="text-xl font-bold text-slate-900 dark:text-white mb-2 outline-none">
            {t('teamSetup.existingMember.members.emptyTitle')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            {t('teamSetup.existingMember.members.emptyDescription')}
          </p>
          <Button onClick={onClose} className="min-h-[44px]">
            {t('teamSetup.existingMember.members.closeAction')}
          </Button>
        </div>
      );
    }

    return (
      <div>
        {renderStepIndicator()}
        <h2 tabIndex={-1} ref={titleRef} className="text-2xl font-bold text-slate-900 dark:text-white mb-6 outline-none">
          {t('teamSetup.existingMember.steps.choosePerson')}
        </h2>
        
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {items.map(item => (
            <button
              key={item.user.uid}
              onClick={() => handlePersonSelect(item.user.uid!)}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-left min-h-[44px]"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.user.photoURL ? (
                    <img src={item.user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {item.user.displayName || item.user.email}
                    </p>
                    {item.isCurrentUser && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full">
                        {t('teamSetup.existingMember.members.youIndicator')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {item.isConfigured ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('teamSetup.existingMember.members.configured')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {!item.hasAccessProfile && !item.hasMinistryFunctions
                          ? t('teamSetup.existingMember.members.missingBoth')
                          : !item.hasAccessProfile
                            ? t('teamSetup.existingMember.members.missingAccess')
                            : t('teamSetup.existingMember.members.missingFunctions')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    if (!policy) return null;
    return (
      <div>
        {renderStepIndicator()}
        <h2 tabIndex={-1} ref={titleRef} className="text-2xl font-bold text-slate-900 dark:text-white mb-6 outline-none">
          {t('teamSetup.existingMember.steps.accessProfile')}
        </h2>
        <AccessProfileSelector
          roles={roles}
          policy={policy}
          selectedRoleId={draft.roleId}
          isOwner={isOwner}
          isCurrentUser={isCurrentUser}
          onSelect={handleAccessSelect}
          onNext={() => setStep(3)}
        />
      </div>
    );
  };

  const renderStep3 = () => (
    <div>
      {renderStepIndicator()}
      <h2 tabIndex={-1} ref={titleRef} className="text-2xl font-bold text-slate-900 dark:text-white mb-6 outline-none">
        {t('teamSetup.existingMember.steps.ministryFunctions')}
      </h2>
      <MinistryFunctionSelector
        ministers={groups.ministers}
        vocals={groups.vocals}
        instruments={groups.instruments}
        selectedIds={draft.specialtyIds || []}
        onToggle={handleFunctionToggle}
        onNext={() => setStep(4)}
        onDefineLater={handleDefineLater}
      />
    </div>
  );

  const renderStep4 = () => {
    if (isCompleted) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 tabIndex={-1} ref={titleRef} className="text-2xl font-bold text-slate-900 dark:text-white mb-2 outline-none">
            {t('teamSetup.existingMember.completion.title')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            {t('teamSetup.existingMember.completion.description')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto min-h-[44px]">
              {t('teamSetup.existingMember.completion.closeAction')}
            </Button>
            <Button onClick={handleNextPerson} className="w-full sm:w-auto min-h-[44px]">
              {t('teamSetup.existingMember.completion.nextAction')}
            </Button>
          </div>
        </div>
      );
    }

    if (!selectedUser) return null;

    const selectedRole = roles.find(r => r.id === draft.roleId);
    const selectedSpecialties = instruments.filter(i => draft.specialtyIds?.includes(i.id));

    return (
      <div>
        {renderStepIndicator()}
        <h2 tabIndex={-1} ref={titleRef} className="text-2xl font-bold text-slate-900 dark:text-white mb-6 outline-none">
          {t('teamSetup.existingMember.steps.review')}
        </h2>
        
        {saveError && (
          <div aria-live="assertive" className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">
              {saveError}
            </p>
          </div>
        )}

        <TeamMemberReview
          user={selectedUser}
          role={selectedRole}
          specialties={selectedSpecialties}
          isOwner={isOwner}
          isCurrentUser={isCurrentUser}
          isSaving={isSaving}
          onSave={handleSave}
          onBack={() => {
            setSaveError(null);
            setStep(3);
          }}
        />
      </div>
    );
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={handleCloseAttempt}
        maxWidth="max-w-md"
        title={t('teamSetup.existingMember.modalTitle', 'Configurar Integrante')}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </Modal>

      <ConfirmationModal
        isOpen={showDiscardConfirm}
        title={t('teamSetup.existingMember.discard.title')}
        message={t('teamSetup.existingMember.discard.description')}
        confirmText={t('teamSetup.existingMember.discard.discardAction')}
        cancelText={t('teamSetup.existingMember.discard.continueAction')}
        onConfirm={handleDiscard}
        onClose={() => setShowDiscardConfirm(false)}
      />
    </>
  );
}
