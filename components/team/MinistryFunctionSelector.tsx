import React from "react";
import { useTranslation } from "react-i18next";
import { Instrument } from "../../types";
import { Check } from "lucide-react";

interface MinistryFunctionSelectorProps {
  groups: {
    ministers: Instrument[];
    vocals: Instrument[];
    instruments: Instrument[];
  };
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export const MinistryFunctionSelector: React.FC<MinistryFunctionSelectorProps> = ({
  groups,
  selectedIds,
  onToggle,
}) => {
  const { t } = useTranslation();

  const renderGroup = (title: string, items: Instrument[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6 last:mb-0">
        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          {title}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(item => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                aria-pressed={isSelected}
                className={`flex items-center justify-between p-3 min-h-[44px] rounded-lg border-2 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-slate-200 dark:border-white/10 hover:border-primary/50"
                }`}
              >
                <span className="font-medium text-slate-900 dark:text-white text-left">{item.name}</span>
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                  isSelected 
                    ? "border-primary bg-primary text-white" 
                    : "border-slate-300 dark:border-slate-600"
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
            {t("teamSetup.functions.hints.0", "Você pode marcar mais de uma opção.")}
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
            {t("teamSetup.functions.hints.1", "Uma pessoa pode servir como vocal e violonista.")}
          </li>
        </ul>
      </div>

      {renderGroup(t("teamSetup.functions.categories.Ministro", "Ministro e liderança musical"), groups.ministers)}
      {renderGroup(t("teamSetup.functions.categories.Voz", "Vozes"), groups.vocals)}
      {renderGroup(t("teamSetup.functions.categories.Instrumento", "Instrumentos e funções técnicas"), groups.instruments)}
    </div>
  );
};
