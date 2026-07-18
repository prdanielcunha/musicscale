import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles } from 'lucide-react';
import { StarterPackAllowance } from '../../utils/starterPackAllowance';
import Card from '../common/Card';

interface StarterPackAllowanceCardProps {
  allowance: StarterPackAllowance;
  onOpen: () => void;
  variant?: 'empty-repertoire' | 'compact' | 'library';
}

export function StarterPackAllowanceCard({ allowance, onOpen, variant = 'compact' }: StarterPackAllowanceCardProps) {
  const { t } = useTranslation();

  if (allowance.completed && variant !== 'library') {
    return null;
  }

  if (variant === 'empty-repertoire') {
    return (
      <Card
        onClick={onOpen}
        interactive
        className="w-full bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all flex flex-col md:flex-row items-start md:items-center p-6 gap-4"
      >
        <div data-testid="starter-pack-empty-card" className="flex-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {t('starterPackAllowance.recommended', 'RECOMENDADO')}
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {t('starterPackAllowance.emptyTitle', 'Começar com o pacote inicial')}
          </h3>
          <p className="text-zinc-400 text-sm mb-3">
            {t('starterPackAllowance.emptyDescription', 'Escolha músicas prontas da Biblioteca Viva para acelerar seu primeiro repertório. Você poderá revisar e editar tudo depois.')}
          </p>
          <p className="text-indigo-400 text-sm font-medium">
            {t('starterPackAllowance.remainingCount', '{{remaining}} de {{limit}} músicas iniciais disponíveis', {
              remaining: allowance.remaining,
              limit: allowance.limit
            })}
          </p>
        </div>
        <div className="flex-shrink-0 w-full md:w-auto">
          <button data-testid="starter-pack-open-action" className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            {t('starterPackAllowance.openAction', 'Ver músicas sugeridas')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Card>
    );
  }

  if (variant === 'compact') {
    if (allowance.completed) return null;
    return (
      <div data-testid="starter-pack-compact-card" className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-white font-medium mb-1">
            {t('starterPackAllowance.compactTitle', 'Seu pacote inicial ainda está disponível')}
          </h4>
          <p className="text-zinc-400 text-sm">
            {t('starterPackAllowance.compactDescription', 'Você ainda pode adicionar {{remaining}} músicas sugeridas ao repertório.', { remaining: allowance.remaining })}
          </p>
        </div>
        <button
          onClick={onOpen}
          data-testid="starter-pack-open-action"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          {t('starterPackAllowance.compactAction', 'Escolher músicas')}
        </button>
      </div>
    );
  }

  // Library variant
  return (
    <Card className="bg-zinc-900 border-zinc-800 p-5 flex flex-col h-full">
      <div className="flex items-center gap-2 text-indigo-400 mb-3">
        <Sparkles className="w-5 h-5" />
        <h3 className="font-medium text-white">
          {allowance.completed 
            ? t('starterPackAllowance.completedTitle', 'Pacote inicial concluído') 
            : t('starterPackAllowance.title', 'Pacote inicial')}
        </h3>
      </div>
      
      <p className="text-zinc-400 text-sm mb-4 flex-1">
        {allowance.completed
          ? t('starterPackAllowance.completedDescription', 'Sua organização utilizou as {{limit}} músicas iniciais.', { limit: allowance.limit })
          : allowance.started
            ? t('starterPackAllowance.usedCount', '{{used}} de {{limit}} utilizadas', { used: allowance.used, limit: allowance.limit })
            : t('starterPackAllowance.initialBenefitExplanation', '10 músicas iniciais incluídas para ajudar sua organização a começar.')
        }
      </p>

      {!allowance.completed && (
        <div className="mt-auto">
          <p className="text-indigo-400 font-medium text-sm mb-3">
            {allowance.started
              ? t('starterPackAllowance.remainingCount', '{{remaining}} de {{limit}} músicas iniciais disponíveis', { remaining: allowance.remaining, limit: allowance.limit })
              : t('starterPackAllowance.availableCount', '{{limit}} disponíveis', { limit: allowance.limit })
            }
          </p>
          <button
            onClick={onOpen}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors text-center"
          >
            {allowance.started 
              ? t('starterPackAllowance.continueAction', 'Continuar escolhendo')
              : t('starterPackAllowance.openAction', 'Ver músicas sugeridas')
            }
          </button>
        </div>
      )}
    </Card>
  );
}
