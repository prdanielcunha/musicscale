import React from 'react';
import { motion } from 'motion/react';
import { Crown, Lock, Sparkles, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { useMusicScaleEntitlements, useMusicScaleFeature, useMusicScalePlan, useMusicScaleUsage } from '../../hooks/useMusicScaleEntitlements';
import { getLockedFeatureMessage, PLAN_PRICING_DETAILS } from '../../lib/limits';
import { MusicScaleFeatures, MusicScalePlan, entitlementsService } from '../../services/entitlementsService';

interface GateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * PremiumBadge - Displays current active plan with clean, high-contrast layouts.
 */
export const PremiumBadge: React.FC<{ plan?: MusicScalePlan; className?: string }> = ({ plan, className = '' }) => {
  const { plan: currentPlan } = useMusicScalePlan();
  const activePlan = plan || currentPlan;

  if (activePlan === 'starter') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 ${className}`}>
        Starter
      </span>
    );
  }

  if (activePlan === 'advanced') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 shadow-sm ${className}`}>
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        Advanced
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60 shadow-sm whitespace-nowrap ${className}`}>
      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
      Pro Lançamento
    </span>
  );
};

/**
 * FeatureLockedCard - Full-sized immersive teaser block card for gating complex views or tools.
 */
export const FeatureLockedCard: React.FC<{
  featureKey: keyof MusicScaleFeatures;
  className?: string;
}> = ({ featureKey, className = '' }) => {
  const { entitlements } = useMusicScaleEntitlements();
  const currentPlan = entitlements?.plan || 'starter';
  const meta = getLockedFeatureMessage(featureKey, currentPlan);
  const pricing = PLAN_PRICING_DETAILS[meta.requiredPlan];

  const handleUpgradeRedirect = () => {
    try {
      const url = entitlementsService.getMillionsNestBaseUrl();
      entitlementsService.logAnalytics('upgrade_btn_clicked', {
        organizationId: entitlements?.organizationId || '',
        feature: featureKey,
        plan: entitlements?.plan || 'starter',
      });
      window.open(`${url}/dashboard/billing`, '_blank', 'noreferrer,noopener');
    } catch (e) {
      window.open('https://millionsnest.com/dashboard/musicscale/plans', '_blank');
    }
  };

  // Precise CTA labels requested by the user
  const ctaLabel = 'Fazer Upgrade';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-3xl border border-indigo-500/10 dark:border-white/10 bg-white/85 dark:bg-zinc-900/70 backdrop-blur-md shadow-xl p-6 sm:p-8 text-center max-w-lg mx-auto ${className}`}
    >
      {/* Background soft visual ambient accents & elegant glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-3xl pointer-events-none rounded-full" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="p-4 rounded-2xl bg-white/90 dark:bg-zinc-800/40 border border-indigo-50/50 dark:border-zinc-700/50 mb-5 shadow-sm">
          {meta.requiredPlan === 'pro' ? (
            <Crown className="w-8 h-8 text-amber-500 fill-amber-500/10" />
          ) : (
            <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
          )}
        </div>

        <h3 className="text-xl font-bold font-sans tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          {meta.title}
        </h3>
        
        <p className="text-sm font-sans leading-relaxed text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
          {meta.description}
        </p>

        {/* Feature Teasers checklist */}
        <div className="w-full bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-150 dark:border-zinc-800/40 p-4 mb-6 text-left space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Colaboração centralizada e segura</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Ferramentas profissionais de repertório</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Acesso integrado no ecossistema MillionsNest</span>
          </div>
        </div>

        {/* Action controls */}
        <button
          onClick={handleUpgradeRedirect}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/15 cursor-pointer touch-target-comfort"
        >
          <span>{ctaLabel} — {pricing.price}/{pricing.pricePeriod}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="mt-4 text-[11px] text-zinc-400 dark:text-zinc-500">
          Gerenciado e faturado de forma segura pelo <strong>MillionsNest Ecosystem</strong>.
        </p>
      </div>
    </motion.div>
  );
};

/**
 * PlanGate - High-level structural gate. Blocks render of children if plan is insufficient.
 */
export interface PlanGateProps extends GateProps {
  requiredPlan: MusicScalePlan;
  featureKey: keyof MusicScaleFeatures;
}

export const PlanGate: React.FC<PlanGateProps> = ({ children, requiredPlan, featureKey, fallback }) => {
  const { plan, loading } = useMusicScalePlan();
  const isAllowed = useMusicScaleFeature(featureKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="py-12 md:py-16">
      <FeatureLockedCard featureKey={featureKey} />
    </div>
  );
};

/**
 * FeatureGate - Fine-grained component/interactive element gate. Modifies render safely.
 */
export interface FeatureGateProps extends GateProps {
  featureKey: keyof MusicScaleFeatures;
  hideInsteadOfFallback?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ children, featureKey, fallback, hideInsteadOfFallback = false }) => {
  const isAllowed = useMusicScaleFeature(featureKey);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (hideInsteadOfFallback) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Fallback default: a disabled looking miniature badge
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700/60 cursor-not-allowed select-none">
      <Lock className="w-2.5 h-2.5" />
      Bloqueado
    </span>
  );
};

/**
 * UpgradeInlineCTA - Elegant small block inline call to upgrade.
 */
export const UpgradeInlineCTA: React.FC<{
  featureKey: keyof MusicScaleFeatures;
  className?: string;
}> = ({ featureKey, className = '' }) => {
  const { entitlements } = useMusicScaleEntitlements();
  const currentPlan = entitlements?.plan || 'starter';
  const meta = getLockedFeatureMessage(featureKey, currentPlan);
  const pricing = PLAN_PRICING_DETAILS[meta.requiredPlan];
  const ctaLabel = meta.requiredPlan === 'pro' ? 'Desbloquear Pro' : 'Fazer upgrade para Advanced';

  const handleUpgradeRedirect = () => {
    try {
      const url = entitlementsService.getMillionsNestBaseUrl();
      window.open(`${url}/dashboard/billing`, '_blank', "noreferrer,noopener");
    } catch (e) {
      window.open('https://millionsnest.com/dashboard/musicscale/plans', '_blank');
    }
  };

  return (
    <div className={`p-5 rounded-2xl border border-indigo-500/10 dark:border-white/10 bg-indigo-50/20 dark:bg-zinc-900/40 backdrop-blur-md relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 font-sans ${className}`}>
      <div className="flex items-center gap-3 text-left w-full sm:w-auto">
        <div className="p-2.5 rounded-xl bg-white/95 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm border border-indigo-50/40">
          {meta.requiredPlan === 'pro' ? <Crown className="w-5 h-5 text-amber-500" /> : <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />}
        </div>
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{meta.title}</h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-md">{meta.description}</p>
        </div>
      </div>
      <button
        onClick={handleUpgradeRedirect}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all shrink-0 cursor-pointer text-center w-full sm:w-auto touch-target-comfort"
      >
        {ctaLabel} — {pricing.price}
      </button>
    </div>
  );
};

/**
 * PlanUsageMeter - Elegant progress indicator comparing custom quota metrics vs limits.
 */
export const PlanUsageMeter: React.FC<{
  type: 'members' | 'imports';
  currentValue: number;
  className?: string;
}> = ({ type, currentValue, className = '' }) => {
  const { plan } = useMusicScalePlan();
  
  let label = '';
  let limit = 0;
  let unit = '';
  
  if (type === 'members') {
    label = 'Vagas de Membros';
    unit = 'membros';
    if (plan === 'starter') limit = 10;
    else if (plan === 'advanced') limit = 20;
    else limit = -1; // unlimited
  } else {
    label = 'Importações da Biblioteca';
    unit = 'imports';
    if (plan === 'starter') limit = 0;
    else if (plan === 'advanced') limit = 20;
    else limit = -1; // unlimited
  }

  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.floor((currentValue / limit) * 100));
  const isClose = percentage >= 80;

  return (
    <div className={`p-4 rounded-xl border border-zinc-150 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md shadow-sm font-sans text-xs ${className}`}>
      <div className="flex justify-between items-center mb-1.5 font-medium text-zinc-700 dark:text-zinc-300">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          {label}
        </span>
        <span className={isClose && !isUnlimited ? "text-amber-600 dark:text-amber-400 font-bold" : "text-zinc-500 dark:text-zinc-400"}>
          {isUnlimited ? 'Ilimitado' : `${currentValue}/${limit} ${unit}`}
        </span>
      </div>
      {!isUnlimited ? (
        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${isClose ? 'bg-amber-500' : 'bg-indigo-600'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : (
        <div className="w-full h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-purple-500 rounded-full opacity-60 animate-pulse" />
      )}
    </div>
  );
};

/**
 * FeaturePreviewCard - Card compared / previewing premium capabilities.
 */
export const FeaturePreviewCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  planBadge: 'advanced' | 'pro';
  onUpgradeClick?: () => void;
  className?: string;
}> = ({ icon, title, description, planBadge, onUpgradeClick, className = '' }) => {
  const handleRedirect = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    try {
      const baseUrl = entitlementsService.getMillionsNestBaseUrl();
      window.open(`${baseUrl}/dashboard/billing`, '_blank', 'noreferrer,noopener');
    } catch (e) {
      window.open('https://millionsnest.com/dashboard/musicscale/plans', '_blank');
    }
  };

  return (
    <div className={`p-6 rounded-2xl border border-zinc-150 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm shadow-sm flex flex-col justify-between gap-4 font-sans ${className}`}>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700/50 shadow-sm">
            {icon}
          </div>
          {planBadge === 'pro' ? (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-950/25 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/30">PRO</span>
          ) : (
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/25 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/30">ADVANCED</span>
          )}
        </div>
        <div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{title}</h4>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
        </div>
      </div>
      <button
        onClick={handleRedirect}
        className="w-full text-center py-2 relative overflow-hidden rounded-xl text-xs font-semibold transition-all border border-zinc-200 hover:border-indigo-600 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300 dark:hover:text-indigo-400 cursor-pointer touch-target-comfort"
      >
        Desbloquear Recurso
      </button>
    </div>
  );
};

/**
 * UpgradePlanModal - A beautiful modal dialog to trigger plan upgrades with direct comparison.
 */
export const UpgradePlanModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  featureKey?: keyof MusicScaleFeatures;
}> = ({ isOpen, onClose, featureKey = 'libraryAccess' }) => {
  if (!isOpen) return null;

  const handleRedirect = () => {
    try {
      const baseUrl = entitlementsService.getMillionsNestBaseUrl();
      window.open(`${baseUrl}/dashboard/billing`, '_blank', 'noreferrer,noopener');
      onClose();
    } catch (e) {
      window.open('https://millionsnest.com/dashboard/musicscale/plans', '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm transition-all overflow-y-auto">
      <div className="w-full max-w-md overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl relative font-sans p-6 sm:p-8">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 dark:bg-zinc-950 text-indigo-500 border border-indigo-100/40 dark:border-indigo-900/40 flex items-center justify-center mb-4 shadow-sm animate-pulse">
            <Sparkles className="w-6 h-6 text-indigo-500" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2">Desbloquear Recursos Premium</h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
            O ecossistema MillionsNest gerencia todas as licenças do MusicScale. Faça seu upgrade a qualquer momento e libere imediatamente a sua equipe no altar.
          </p>

          <div className="space-y-2.5 mb-6 text-left max-w-xs mx-auto bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800/80">
            <div className="flex gap-2.5 items-center text-xs text-zinc-600 dark:text-zinc-300">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Acesso à Biblioteca de cifras prontas</span>
            </div>
            <div className="flex gap-2.5 items-center text-xs text-zinc-600 dark:text-zinc-300">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Inteligência Artificial de repertório</span>
            </div>
            <div className="flex gap-2.5 items-center text-xs text-zinc-600 dark:text-zinc-300">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Clonagem em um toque e muito mais</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRedirect}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/10 transition-all text-center cursor-pointer touch-target-comfort"
            >
              Ir para Cental de Cobrança MillionsNest
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/60 transition-all cursor-pointer touch-target-comfort"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * UsageLimitBanner - Elegant micro progress banner showing monthly consumption details.
 */
export const UsageLimitBanner: React.FC<{ featureKey: 'libraryAccess' | string }> = ({ featureKey }) => {
  const { usage, limits, loading } = useMusicScaleUsage();

  if (loading || limits.libraryImportsPerMonth === -1 || limits.libraryImportsPerMonth === 0) {
    return null;
  }

  const current = usage.libraryImports || 0;
  const max = limits.libraryImportsPerMonth;
  const percent = Math.min(100, Math.floor((current / max) * 100));
  const isClose = percent >= 80;

  return (
    <div className={`p-4 rounded-xl border font-sans text-xs flex flex-col gap-2 transition-all ${
      isClose 
        ? 'bg-amber-50/60 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-900/30' 
        : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-100 dark:border-zinc-700/60'
    }`}>
      <div className="flex items-center justify-between font-medium">
        <span className="text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          Biblioteca Viva - Uso Mensal
        </span>
        <span className={isClose ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}>
          {current} de {max} imports
        </span>
      </div>
      
      {/* Visual progress track */}
      <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${isClose ? 'bg-amber-500' : 'bg-indigo-600'}`} 
          style={{ width: `${percent}%` }} 
        />
      </div>

      {isClose && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 block tracking-tight font-medium">
          Aviso: Você utilizou {percent}% de sua capacidade de imports deste mês. Aumente seu plano se precisar de mais.
        </span>
      )}
    </div>
  );
};

/**
 * SubscriptionBlockedState - Block container presented when a subscription document reports unpaid status.
 * Replaces complex routers or hard rejections with a beautiful premium paywall block that allows general navigation back.
 */
export const SubscriptionBlockedState: React.FC = () => {
  const { entitlements } = useMusicScaleEntitlements();

  const handleSupportRedirect = () => {
    window.location.href = 'mailto:suporte@millionsnest.com';
  };

  const handleRetryBilling = () => {
    const url = entitlementsService.getMillionsNestBaseUrl();
    window.open(`${url}/dashboard/billing`, '_blank', 'noreferrer,noopener');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white/95 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800/85 rounded-3xl shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100/30 dark:border-amber-900/30 flex items-center justify-center mb-6 shadow-sm">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
          Assinatura precisa de atenção
        </h2>

        <p className="text-xs sm:text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 mb-6">
          Para continuar usando todos os recursos do MusicScale, atualize a assinatura da sua organização no MillionsNest.
        </p>

        {/* Quick subscription indicators */}
        <div className="bg-zinc-50/50 dark:bg-zinc-900/30 backdrop-blur-sm rounded-2xl border border-zinc-150 dark:border-zinc-800 p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
            <span>Organização:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {entitlements?.organizationId || 'Ministério de Louvor'}
            </span>
          </div>
          <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
            <span>Status do ERP MillionsNest:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
              {entitlements?.status || 'pendente'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRetryBilling}
            className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer touch-target-comfort"
          >
            <span>Gerenciar assinatura</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleSupportRedirect}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 bg-transparent transition-colors cursor-pointer touch-target-comfort"
          >
            Contatar Suporte do Idealizador
          </button>
        </div>

        <p className="mt-6 text-[10px] text-zinc-400">
          Ao regularizar na plataforma faturadora, seu acesso no MusicScale será liberado instantaneamente.
        </p>
      </motion.div>
    </motion.div>
  );
};
