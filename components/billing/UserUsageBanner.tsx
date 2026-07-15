import React from 'react';
import { useMusicScalePlan, useMusicScaleUsage } from '../../hooks/useMusicScaleEntitlements';
import { entitlementsService } from '../../services/entitlementsService';
import { Users, Info, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function UserUsageBanner() {
  const { t } = useTranslation();
  const { plan, loading: planLoading } = useMusicScalePlan();
  const { usage, limits, loading: usageLoading } = useMusicScaleUsage();
  
  if (planLoading || usageLoading) {
    return (
      <div className="animate-pulse bg-white/50 dark:bg-zinc-900/50 rounded-2xl h-16 border border-zinc-200 dark:border-zinc-800"></div>
    );
  }

  const handleUpgrade = () => {
    const url = entitlementsService.getMillionsNestBaseUrl();
    window.open(`${url}/dashboard/billing`, '_blank', 'noreferrer,noopener');
  };
  
  if (plan === 'pro') {
    return (
      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
              Usuários Ilimitados liberados
              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-indigo-600 text-white ring-1 ring-indigo-400/50">Pro</span>
            </h4>
            <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 font-medium">{t("billing.invite_team", "Convide toda a banda. Não há limite de membros no Pro.")}</p>
          </div>
        </div>
      </div>
    );
  }

  const usedUsers = usage?.users ?? 1;
  const userLimit = limits?.users || 10;
  const percentage = Math.min(100, Math.max(0, (usedUsers / userLimit) * 100));
  const isAtLimit = usedUsers >= userLimit;
  const isNearLimit = percentage >= 80;

  return (
    <div className={`rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-6 border transition-all ${
      isAtLimit 
        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' 
        : 'bg-zinc-100/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5'
    }`}>
      <div className="flex items-center gap-3.5 flex-1 min-w-0 w-full">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isAtLimit 
            ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' 
            : 'bg-white dark:bg-zinc-800 text-zinc-500 shadow-sm border border-black/5 dark:border-white/5'
        }`}>
          {isAtLimit ? <Info className="w-4 h-4" /> : <Users className="w-4 h-4" />}
        </div>
        <div className="flex-1 w-full max-w-sm">
          <div className="flex items-center justify-between font-sans mb-1.5">
            <h4 className={`text-[13px] font-bold tracking-tight ${
              isAtLimit ? 'text-red-900 dark:text-red-100' : 'text-zinc-900 dark:text-white'
            }`}>
              {t("billing.users_in_plan", "{{used}} de {{limit}} usuários no plano", { used: usedUsers, limit: userLimit })}
            </h4>
            <span className="text-[9px] font-bold uppercase tracking-widest bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.05] px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
              {plan === 'advanced' ? 'Advanced' : 'Starter'}
            </span>
          </div>
          <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-zinc-800 dark:bg-zinc-400'
              }`} 
              style={{ width: `${percentage}%` }}
            />
          </div>
          {isAtLimit ? (
             <p className="text-[11px] font-semibold text-red-700 dark:text-red-400/90 mt-1.5">
               {t("billing.plan_full", "Plano lotado. Faça upgrade hoje para convidar mais membros e desbloquear recursos premium.")}
             </p>
          ) : (
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1.5">
               {t("billing.spots_left", "{{count}} vaga restante", { count: userLimit - usedUsers })} 
            </p>
          )}
        </div>
      </div>
      
      {isAtLimit && (
        <button
          onClick={handleUpgrade}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 shrink-0"
        >
          <Zap className="w-3.5 h-3.5" />
          Fazer Upgrade
        </button>
      )}
    </div>
  );
}
