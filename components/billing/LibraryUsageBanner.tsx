import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMusicScalePlan, useMusicScaleUsage, useMusicScaleFeature } from '../../hooks/useMusicScaleEntitlements';
import { Sparkles, Library, ArrowRight, Zap, Target } from 'lucide-react';
import { entitlementsService } from '../../services/entitlementsService';

export function LibraryUsageBanner() {
  const { t } = useTranslation();
  const { plan, loading: planLoading } = useMusicScalePlan();
  const { usage, limits, loading: usageLoading } = useMusicScaleUsage();
  
  const hasLibrary = useMusicScaleFeature('libraryAccess');
  
  if (planLoading || usageLoading) {
    return (
      <div className="animate-pulse bg-white/50 dark:bg-zinc-900/50 rounded-2xl h-16 border border-zinc-200 dark:border-zinc-800"></div>
    );
  }

  const handleUpgrade = () => {
    const url = entitlementsService.getMillionsNestBaseUrl();
    window.open(`${url}/dashboard/billing`, '_blank', 'noreferrer,noopener');
  };

  // Starter
  if (!hasLibrary) {
    return (
      <div className="bg-white dark:bg-[#131315] border border-black/5 dark:border-white/10 rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-[16px] bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
            <Library className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 mb-1">
              {t("billing.library_blocked", "Biblioteca Viva bloqueada")}
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Starter
              </span>
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              {t("billing.library_blocked_desc", "Biblioteca Viva disponível a partir do plano Advanced.")}
            </p>
            <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mt-1">
              {t("starterPackAllowance.separateFromPlan", "O pacote inicial é separado do limite da sua assinatura.")}
            </p>
          </div>
        </div>
        <button
          onClick={handleUpgrade}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl text-[13px] font-bold text-white bg-slate-900 border border-slate-900 hover:bg-black dark:text-black dark:bg-white dark:border-white dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 shrink-0 shadow-md active:scale-[0.98]"
        >
          <Zap className="w-4 h-4 fill-current opacity-90" />
          {t("billing.unlock_library", "Liberar Biblioteca Viva")}
        </button>
      </div>
    );
  }

  // Pro
  if (plan === 'pro') {
    return (
      <div className="relative overflow-hidden bg-white dark:bg-[#131315] border border-black/5 dark:border-white/10 rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-5 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-white/5 to-transparent rotate-45 pointer-events-none"></div>
        <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto relative z-10">
          <div className="w-12 h-12 rounded-[16px] bg-slate-100 dark:bg-white/5 shadow-inner border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-slate-800 dark:text-slate-200" />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 mb-1">
              {t("billing.library_complete", "Biblioteca Viva completa")}
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm">
                Pro
              </span>
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm">
              {t("billing.unlimited_imports_desc", "Importações ilimitadas liberadas. Adicione músicas prontas sem restrições.")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Advanced
  const used = usage?.libraryImports || 0;
  
  if (!limits && !usageLoading) {
     return <div className="animate-pulse bg-white/50 dark:bg-zinc-900/50 rounded-2xl h-16 border border-zinc-200 dark:border-zinc-800"></div>;
  }
  
  const limit = limits?.libraryImportsPerMonth ?? 0;
  const remaining = Math.max(0, limit - used);
  const percentage = Math.min(100, Math.max(0, (used / limit) * 100));
  const isNearLimit = percentage >= 80;
  const isAtLimit = used >= limit;

  return (
    <div className={`rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border transition-all duration-300 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${
      isAtLimit 
        ? 'bg-orange-50/50 dark:bg-[#1A1310] border-orange-200/50 dark:border-orange-900/30' 
        : 'bg-white dark:bg-[#131315] border-black/5 dark:border-white/10'
    }`}>
      
      <div className="flex items-center gap-4 sm:gap-5 flex-1 w-full relative z-10">
        <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 border ${
          isAtLimit 
            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' 
            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
        }`}>
          {isAtLimit ? <Target className="w-6 h-6" /> : <Library className="w-6 h-6" />}
        </div>
        
        <div className="flex-1 w-full max-w-sm">
          <div className="flex items-center justify-between font-sans mb-2">
            <h4 className={`text-sm md:text-base font-black tracking-tight ${
              isAtLimit ? 'text-orange-900 dark:text-orange-100' : 'text-slate-900 dark:text-white'
            }`}>
              {t("starterPackAllowance.planAllowanceTitle", "Seu plano")}
            </h4>
            <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 px-2.5 py-1 rounded-md">
              Advanced
            </span>
          </div>
          
          <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                isAtLimit ? 'bg-orange-500' : isNearLimit ? 'bg-amber-400' : 'bg-emerald-500'
              }`} 
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          {isAtLimit ? (
             <p className="text-[12px] font-bold text-orange-700 dark:text-orange-400 mt-2">
               {t("billing.limit_reached_desc", "Limite mensal alcançado. Liberaremos mais vagas mês que vem.")}
             </p>
          ) : isNearLimit ? (
             <p className="text-[12px] font-bold text-amber-600 dark:text-amber-500 mt-2">
               {t("billing.near_limit_desc", "Você está quase no limite mensal.")}
             </p>
          ) : (
             <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-2">
               {t("starterPackAllowance.monthlyRemaining", "{{remaining}} importações disponíveis neste ciclo", { remaining })}
             <span className="block mt-1 text-[11px] opacity-75">{t("billing.renewal_desc", "Renovação do ciclo mensal dia 1º.")}</span>
             </p>
          )}
        </div>
      </div>
      
      {(isAtLimit || isNearLimit) && (
        <button
          onClick={handleUpgrade}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl text-[13px] font-bold text-white bg-slate-900 border border-slate-900 hover:bg-black dark:text-black dark:bg-white dark:border-white dark:hover:bg-slate-200 shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
        >
          {isAtLimit ? t("billing.unlimited_on_pro", "Importe sem limites no Pro") : t("billing.grow_with_pro", "Cresça sem limites com o Pro")}
        </button>
      )}
    </div>
  );
}
