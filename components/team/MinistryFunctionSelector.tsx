import React from 'react';
import { useTranslation } from 'react-i18next';
import { Instrument } from '../../types';
import Button from '../common/Button';
import { CheckSquare, Square } from 'lucide-react';

interface MinistryFunctionSelectorProps {
  ministers: Instrument[];
  vocals: Instrument[];
  instruments: Instrument[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
  onDefineLater: () => void;
  onBack: () => void;
}

export function MinistryFunctionSelector({
  ministers,
  vocals,
  instruments,
  selectedIds,
  onToggle,
  onNext,
  onDefineLater,
  onBack
}: MinistryFunctionSelectorProps) {
  const { t } = useTranslation();

  const renderGroup = (title: string, items: Instrument[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
          {title}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(item => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggle(item.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors min-h-[44px]
                  ${isSelected
                    ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                    : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:hover:border-slate-600'
                  }
                `}
              >
                <div className="shrink-0 text-indigo-600 dark:text-indigo-400">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                  )}
                </div>
                <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        {t('teamSetup.existingMember.functions.subtitle')}
      </p>

      {renderGroup(t('teamSetup.existingMember.functions.groups.ministers'), ministers)}
      {renderGroup(t('teamSetup.existingMember.functions.groups.vocals'), vocals)}
      {renderGroup(t('teamSetup.existingMember.functions.groups.instruments'), instruments)}

      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          className="w-full sm:w-auto min-h-[44px]"
        >
          {t('teamSetup.existingMember.actions.backToAccess')}
        </Button>
        <div className="flex flex-col-reverse sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Button 
            variant="ghost" 
            onClick={onDefineLater}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {t('teamSetup.existingMember.functions.defineLaterAction')}
          </Button>
          <Button 
            onClick={onNext}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {t('teamSetup.existingMember.functions.continueAction')}
          </Button>
        </div>
      </div>
    </div>
  );
}
