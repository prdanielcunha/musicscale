import React from 'react';
import { useTranslation } from 'react-i18next';
import { Role } from '../../types';
import { TeamMemberAccessPolicy } from '../../utils/teamMemberSetup';
import Button from '../common/Button';
import { CheckCircle2, Circle } from 'lucide-react';

interface AccessProfileSelectorProps {
  roles: readonly Role[];
  policy: TeamMemberAccessPolicy;
  selectedRoleId: string | undefined;
  isOwner: boolean;
  isCurrentUser: boolean;
  onSelect: (roleId: string) => void;
  onNext: () => void;
}

export function AccessProfileSelector({
  roles,
  policy,
  selectedRoleId,
  isOwner,
  isCurrentUser,
  onSelect,
  onNext
}: AccessProfileSelectorProps) {
  const { t } = useTranslation();

  const permissionKeys = [
    'canManageUsers',
    'canManageRoles',
    'canManageRepertoire',
    'canManageScales',
    'canManageChords',
    'canViewContent'
  ] as const;

  if (isOwner || !policy.canEditAccess) {
    const roleToShow = roles.find(r => r.id === selectedRoleId);
    
    return (
      <div className="space-y-6">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          {roleToShow ? (
            <div>
              <h3 className="text-base font-medium text-slate-900 dark:text-white">
                {roleToShow.name}
              </h3>
              {roleToShow.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {roleToShow.description}
                </p>
              )}
              <ul className="mt-4 space-y-2">
                {permissionKeys.map(key => {
                  if (roleToShow.permissions[key]) {
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
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t('teamSetup.existingMember.members.missingAccess')}
            </p>
          )}
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            {isOwner 
              ? t('teamSetup.existingMember.access.ownerExplanation')
              : isCurrentUser
                ? t('teamSetup.existingMember.access.currentUserExplanation')
                : policy.reason}
          </p>
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={onNext} className="min-h-[44px]">
            {t('teamSetup.existingMember.access.continueAction')}
          </Button>
        </div>
      </div>
    );
  }

  const allowedRoles = roles.filter(r => policy.allowedRoleIds.includes(r.id));

  return (
    <div className="space-y-6">
      <div className="space-y-3" role="radiogroup" aria-label={t('teamSetup.existingMember.steps.accessProfile')}>
        {allowedRoles.map(role => {
          const isSelected = selectedRoleId === role.id;
          return (
            <button
              key={role.id}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(role.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(role.id); } }}
              className={`w-full text-left p-4 rounded-lg border transition-colors min-h-[44px]
                ${isSelected 
                  ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' 
                  : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:hover:border-slate-600'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-400" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <h3 className={`text-base font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-900 dark:text-white'}`}>
                    {role.name}
                  </h3>
                  {role.description && (
                    <p className={`text-sm mt-1 ${isSelected ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {role.description}
                    </p>
                  )}
                  <ul className="mt-3 space-y-1.5">
                    {permissionKeys.map(key => {
                      if (role.permissions[key]) {
                        return (
                          <li key={key} className={`flex items-start gap-2 text-sm ${isSelected ? 'text-indigo-800 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0" aria-hidden="true" />
                            <span>{t(`teamSetup.existingMember.access.permissionsMap.${key}`)}</span>
                          </li>
                        );
                      }
                      return null;
                    })}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-4 flex justify-end">
        <Button 
          onClick={onNext} 
          disabled={!selectedRoleId}
          className="min-h-[44px]"
        >
          {t('teamSetup.existingMember.access.continueAction')}
        </Button>
      </div>
    </div>
  );
}
