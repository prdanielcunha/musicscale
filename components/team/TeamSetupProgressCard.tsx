import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { TeamSetupSummary } from '../../utils/teamSetup';
import { CheckCircle2, AlertCircle, Users } from 'lucide-react';

interface TeamSetupProgressCardProps {
  summary: TeamSetupSummary;
  onReview: () => void;
}

export function TeamSetupProgressCard({ summary, onReview }: TeamSetupProgressCardProps) {
  const { t } = useTranslation();

  const {
    additionalMembers,
    configuredMembers,
    membersWithAccessProfile,
    membersWithMinistryFunctions
  } = summary;

  const noMembers = additionalMembers === 0;
  const isComplete = additionalMembers > 0 && configuredMembers === additionalMembers;
  const missingAccess = additionalMembers - membersWithAccessProfile;
  const missingFunctions = additionalMembers - membersWithMinistryFunctions;

  let title = '';
  let description = '';
  let icon = null;

  if (noMembers) {
    title = t('teamSetup.progress.emptyTitle');
    description = t('teamSetup.progress.emptyDescription');
    icon = <Users className="w-5 h-5 text-indigo-500" aria-hidden="true" />;
  } else if (isComplete) {
    title = t('teamSetup.progress.completeTitle');
    description = t('teamSetup.progress.completeDescription');
    icon = <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden="true" />;
  } else {
    title = t('teamSetup.progress.incompleteTitle');
    icon = <AlertCircle className="w-5 h-5 text-amber-500" aria-hidden="true" />;
  }

  return (
    <Card padding="none" className="mb-8" aria-labelledby="team-setup-progress-title">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 shrink-0 bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
            {icon}
          </div>
          <div>
            <h2 id="team-setup-progress-title" className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            
            {description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {description}
              </p>
            )}

            {!noMembers && !isComplete && (
              <ul className="mt-3 space-y-1.5" aria-live="polite">
                <li className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white">{additionalMembers}</span>{' '}
                  {t('teamSetup.progress.membersAdded', { count: additionalMembers })}
                </li>
                <li className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{configuredMembers}</span>{' '}
                  {t('teamSetup.progress.configured', { count: configuredMembers })}
                </li>
                {missingAccess > 0 && (
                  <li className="text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-medium">{missingAccess}</span>{' '}
                    {t('teamSetup.progress.missingAccess', { count: missingAccess })}
                  </li>
                )}
                {missingFunctions > 0 && (
                  <li className="text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-medium">{missingFunctions}</span>{' '}
                    {t('teamSetup.progress.missingFunctions', { count: missingFunctions })}
                  </li>
                )}
              </ul>
            )}
            {isComplete && (
              <ul className="mt-3 space-y-1.5" aria-live="polite">
                <li className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white">{additionalMembers}</span>{' '}
                  {t('teamSetup.progress.membersAdded', { count: additionalMembers })}
                </li>
                <li className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">{configuredMembers}</span>{' '}
                  {t('teamSetup.progress.configured', { count: configuredMembers })}
                </li>
              </ul>
            )}
            {noMembers && (
               <ul className="mt-3 space-y-1.5" aria-live="polite">
                <li className="text-sm text-slate-600 dark:text-slate-300">
                  {t('teamSetup.progress.noMembers')}
                </li>
              </ul>
            )}
          </div>
        </div>
        <div className="w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
          <Button 
            variant="secondary" 
            onClick={onReview}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isComplete 
              ? t('teamSetup.progress.reviewCompletedAction')
              : t('teamSetup.progress.reviewAction')
            }
          </Button>
        </div>
      </div>
    </Card>
  );
}
