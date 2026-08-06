import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserProfile, Role, Instrument } from '../../types';
import Button from '../common/Button';
import { CheckCircle2, AlertTriangle, User } from 'lucide-react';

interface TeamMemberReviewProps {
  user: UserProfile;
  role: Role | undefined;
  specialties: Instrument[];
  isSaving: boolean;
  onSave: () => void;
  onBack: () => void;
}

export function TeamMemberReview({
  user,
  role,
  specialties,
  isSaving,
  onSave,
  onBack
}: TeamMemberReviewProps) {
  const { t } = useTranslation();

  const permissionKeys = [
    'canManageUsers',
    'canManageRoles',
    'canManageRepertoire',
    'canManageScales',
    'canManageChords',
    'canViewContent'
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-slate-400" aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {user.displayName || user.email}
          </p>
          {user.displayName && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
            {t('teamSetup.existingMember.review.accessLabel')}
          </h4>
          {role ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <p className="font-medium text-slate-900 dark:text-white">{role.name}</p>
              <ul className="mt-2 space-y-1">
                {permissionKeys.map(key => {
                  if (role.permissions[key]) {
                    return (
                      <li key={key} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{t(`teamSetup.existingMember.access.permissionsMap.${key}`)}</span>
                      </li>
                    );
                  }
                  return null;
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {t('teamSetup.existingMember.members.missingAccess')}
            </p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
            {t('teamSetup.existingMember.review.functionsLabel')}
          </h4>
          {specialties.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {specialties.map(spec => (
                <span 
                  key={spec.id}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800"
                >
                  {spec.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{t('teamSetup.existingMember.review.noFunctionsWarning')} {t('teamSetup.existingMember.functions.incompleteWarning')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
        <Button 
          variant="ghost" 
          onClick={onBack}
          disabled={isSaving}
          className="w-full sm:w-auto min-h-[44px]"
        >
          {t('teamSetup.existingMember.review.backAction')}
        </Button>
        <Button 
          onClick={onSave}
          loading={isSaving}
          className="w-full sm:w-auto min-h-[44px]"
        >
          {t('teamSetup.existingMember.review.saveAction')}
        </Button>
      </div>
    </div>
  );
}
