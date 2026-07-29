import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, RefreshCcw, AlertTriangle } from 'lucide-react';
import { StarterPackAllowance } from '../../utils/starterPackAllowance';
import { StarterPackError } from '../../hooks/useStarterPackAllowance';
import Card from '../common/Card';
import { UsageProgress } from '../common/UsageProgress';

interface StarterPackAllowanceCardProps {
  allowance?: StarterPackAllowance | null;
  loading?: boolean;
  error?: StarterPackError | null;
  onOpen: () => void;
  onRetry?: () => void;
  variant?: 'empty-repertoire' | 'compact' | 'library';
}

export function StarterPackAllowanceCard({
  allowance,
  loading = false,
  error = null,
  onOpen,
  onRetry,
  variant = 'compact'
}: StarterPackAllowanceCardProps) {
  const { t } = useTranslation();

  if (loading) {
    if (variant === 'empty-repertoire') {
      return (
        <Card data-testid="starter-pack-loading" className="w-full bg-zinc-900/50 border-zinc-800 p-6">
          <div className="animate-pulse flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1 w-full">
              <div className="h-6 bg-zinc-800 rounded w-32 mb-3"></div>
              <div className="h-6 bg-zinc-800 rounded w-64 mb-3"></div>
              <div className="h-4 bg-zinc-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-zinc-800 rounded w-48"></div>
            </div>
            <div className="h-10 bg-zinc-800 rounded w-40"></div>
          </div>
        </Card>
      );
    }
    return (
      <Card data-testid="starter-pack-loading" className="bg-zinc-900 border-zinc-800 p-5 flex flex-col h-full animate-pulse">
        <div className="h-6 bg-zinc-800 rounded w-40 mb-3"></div>
        <div className="h-4 bg-zinc-800 rounded w-full mb-2"></div>
        <div className="h-4 bg-zinc-800 rounded w-3/4 mb-4"></div>
        <div className="mt-auto h-2 bg-zinc-800 rounded-full w-full mb-3"></div>
        <div className="h-10 bg-zinc-800 rounded w-full"></div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="starter-pack-error" className="bg-zinc-900 border-zinc-800 p-5 flex flex-col h-full justify-center">
        <div className="flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="font-medium text-white mb-2">
            {t('starterPackAllowance.errorTitle', 'Pacote inicial temporariamente indisponível')}
          </h3>
          <p className="text-zinc-400 text-sm mb-4">
            {t('starterPackAllowance.errorDescription', 'Não foi possível consultar suas músicas iniciais agora.')}
          </p>
          {error.correlationId && (
            <p className="text-zinc-500 text-xs mb-4">
              {t('starterPackAllowance.errorCode', 'Código de atendimento: {{correlationId}}', { correlationId: error.correlationId })}
            </p>
          )}
          {onRetry && (
            <button
              data-testid="starter-pack-retry"
              onClick={onRetry}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              {t('starterPackAllowance.retryAction', 'Tentar novamente')}
            </button>
          )}
        </div>
      </Card>
    );
  }

  if (!allowance) return null;

  if (allowance.completed && variant !== 'library') {
    return null;
  }

  if (variant === 'empty-repertoire') {
    return (
      <Card
        onClick={onOpen}
        interactive="true"
        className="w-full bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all flex flex-col md:flex-row items-start md:items-center p-6 gap-4"
      >
        <div data-testid="starter-pack-empty-card" className="flex-1 w-full">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {t('starterPackAllowance.recommended', 'RECOMENDADO')}
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {t('starterPackAllowance.emptyTitle', 'Começar com o pacote inicial')}
          </h3>
          <p className="text-zinc-400 text-sm mb-4">
            {t('starterPackAllowance.emptyDescription', 'Escolha músicas prontas da Biblioteca Viva para acelerar seu primeiro repertório. Você poderá revisar e editar tudo depois.')}
          </p>
          <UsageProgress
            used={allowance.used}
            limit={allowance.limit}
            tone="indigo"
            label={<span className="text-indigo-400">{t('starterPackAllowance.remainingCount', '{{remaining}} de {{limit}} músicas iniciais disponíveis', { remaining: allowance.remaining, limit: allowance.limit })}</span>}
          />
        </div>
        <div className="flex-shrink-0 w-full md:w-auto mt-4 md:mt-0">
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
        <div className="flex-1 w-full">
          <h4 className="text-white font-medium mb-1">
            {t('starterPackAllowance.compactTitle', 'Seu pacote inicial ainda está disponível')}
          </h4>
          <p className="text-zinc-400 text-sm mb-2">
            {t('starterPackAllowance.compactDescription', 'Você ainda pode adicionar {{remaining}} músicas sugeridas ao repertório.', { remaining: allowance.remaining })}
          </p>
          <UsageProgress used={allowance.used} limit={allowance.limit} tone="indigo" />
        </div>
        <button
          onClick={onOpen}
          data-testid="starter-pack-open-action"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 w-full sm:w-auto"
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
      
      <p className="text-zinc-400 text-sm mb-4">
        {allowance.completed
          ? t('starterPackAllowance.completedDescription', 'Sua organização utilizou as {{limit}} músicas iniciais.', { limit: allowance.limit })
          : allowance.started
            ? t('starterPackAllowance.usedCount', '{{used}} de {{limit}} utilizadas', { used: allowance.used, limit: allowance.limit })
            : t('starterPackAllowance.initialBenefitExplanation', '10 músicas iniciais incluídas para ajudar sua organização a começar.')
        }
      </p>

      <div className="mt-auto">
        <div className="mb-4">
          <UsageProgress 
            used={allowance.used} 
            limit={allowance.limit} 
            tone="indigo" 
            label={!allowance.completed ? <span className="text-zinc-400 text-xs">{t('starterPackAllowance.remainingCount', '{{remaining}} disponíveis', { remaining: allowance.remaining })}</span> : undefined}
          />
        </div>

        {!allowance.completed && (
          <button
            onClick={onOpen}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors text-center"
          >
            {allowance.started 
               ? t('starterPackAllowance.continueAction', 'Continuar escolhendo')
              : t('starterPackAllowance.openAction', 'Ver músicas sugeridas')
            }
          </button>
        )}
      </div>
    </Card>
  );
}
