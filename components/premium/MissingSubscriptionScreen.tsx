import React from 'react';
import { motion } from 'motion/react';
import { Lock, CreditCard, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { entitlementsService } from '../../services/entitlementsService';

import { SubscriptionAccessResolution } from '../../utils/subscriptionAccessResolver';
import { useTranslation } from 'react-i18next';
import { logger } from '../../lib/logger';

export const MissingSubscriptionScreen: React.FC<{ resolution?: SubscriptionAccessResolution }> = ({ resolution: propResolution }) => {
  const { loading, refreshSubscriptionAccess, organization } = useAuth();
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = React.useState(false);

  

  const resolution = propResolution || { valid: false, status: 'inactive', reason: 'unknown', technicalError: false } as SubscriptionAccessResolution;
  const { reason, message, status, technicalError } = resolution;

  const handlePlansRedirect = () => {
    const url = entitlementsService.getMillionsNestBaseUrl();
    window.location.href = `${url}/dashboard/musicscale/plans`;
  };

  const handleGoBack = () => {
    try {
      const url = entitlementsService.getMillionsNestBaseUrl();
      window.location.href = `${url}/dashboard`;
    } catch {
      window.history.back();
    }
  };

  const handleRetry = async () => {
    if (isRetrying || loading) return;
    setIsRetrying(true);
    try {
        const result = await refreshSubscriptionAccess();
        logger.info('[MusicScale] Retry Access Sync Result', {
            organizationId: organization?.id,
            status: result.status,
            reason: result.reason,
            technicalError: result.technicalError
        });
    } catch (e: any) {
        logger.error('[MusicScale] Sync Access Failed', {
            organizationId: organization?.id,
            reason: e.message
        });
    } finally {
        setIsRetrying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10000] bg-zinc-950/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto font-sans"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />

        <div className="mx-auto w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center mb-6 shadow-lg shadow-black/20">
          <Lock className="w-7 h-7 text-zinc-300" />
        </div>

        
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-3">
          {technicalError ? t('premium.sync_error', 'Problema de sincronização') : t('premium.missing_title', 'Não encontramos uma assinatura ativa')}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400 mb-8 max-w-sm mx-auto">
          {technicalError 
            ? t('premium.sync_error_desc', 'Tivemos um problema ao confirmar seu acesso. Por favor, tente sincronizar novamente.')
            : t('premium.missing_desc', 'Parece que sua assinatura do MusicScale está cancelada, expirada ou ainda não foi ativada. Você pode escolher um plano novamente pelo MillionsNest e voltar a usar o app normalmente.')}
        </p>
  

        <div className="space-y-3 relative z-10">
          
          {!technicalError && (
            <button
              onClick={handlePlansRedirect}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15"
            >
              <CreditCard className="w-4 h-4" />
              <span>{t('premium.view_plans', 'Ver planos no MillionsNest')}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          )}
  

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleRetry}
              disabled={isRetrying || loading}
              className="w-full py-3 px-4 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-zinc-400' : ''}`} />
              <span>{isRetrying ? t('premium.syncing', 'Sincronizando...') : t('premium.retry', 'Tentar novamente')}</span>
            </button>

            <button
              onClick={handleGoBack}
              className="w-full py-3 px-4 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/50 transition-colors"
            >
              {t('premium.go_back', 'Voltar ao Início')}
            </button>
          </div>
        </div>

        {/* Small debug/technical helper discretely shown */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 text-[10px] text-zinc-500">
           <p>{t('premium.reason', 'Motivo')}: {message} ({reason})</p>
           {organization?.id && <p>Org ID: {organization.id}</p>}
        </div>
      </motion.div>
    </motion.div>
  );
};
