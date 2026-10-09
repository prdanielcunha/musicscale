import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CreditCard, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useCapability } from '../../hooks/useCapability';
import type { MusicScaleEntitlements, MusicScalePlan } from '../../services/entitlementsConstants';
import { entitlementsService } from '../../services/entitlementsService';
import { catalogAnnualSavings, toMusicScalePlanCatalog } from '../../utils/canonicalPlanCatalog';
import type { CatalogCycle, CatalogPriceMap, CatalogProduct } from '../../utils/canonicalPlanCatalog';

const TIERS: MusicScalePlan[] = ['starter', 'advanced', 'pro'];

interface Props {
  entitlement: MusicScaleEntitlements | null;
  currentPlan: MusicScalePlan;
  status: MusicScaleEntitlements['status'] | string;
  loading: boolean;
}

export function CanonicalPlanSelector({ entitlement, currentPlan, status, loading }: Props) {
  const { t, i18n } = useTranslation();
  const { isOwner, isGlobalAdmin } = useAuth();
  const { hasCapability } = useCapability();
  const canManageBilling = isOwner || isGlobalAdmin ||
    hasCapability('organization.billing.manage') || hasCapability('billing.manage');

  const isExistingSubscription = entitlement?.entitlementSource !== 'hub_internal_trial' &&
    ['active','trialing','past_due','canceled'].includes(status);
  const [cycle, setCycle] = useState<CatalogCycle>('monthly');
  const [tier, setTier] = useState<MusicScalePlan>(isExistingSubscription ? currentPlan : 'advanced');
  const [catalog, setCatalog] = useState<CatalogPriceMap>({});
  const [catalogError, setCatalogError] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const selectedProduct = catalog[tier]?.[cycle];

  // The product catalog from MillionsNest is authoritative, not a fallback
  // price hardcoded in the MusicScale client. A failed request disables checkout.
  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError(false);
    const hub = entitlementsService.getMillionsNestBaseUrl();
    fetch(`${hub}/api/v1/billing/products`, {
      headers:{Accept:'application/json'},signal:controller.signal,
    }).then(async response=>{
      if(!response.ok)throw Error('HUB_CATALOG_UNAVAILABLE');
      return response.json();
    }).then(value=>{
      if(controller.signal.aborted)return;
      const parsed = toMusicScalePlanCatalog(value);
      if(!TIERS.some(plan=>Boolean(parsed[plan]?.monthly || parsed[plan]?.yearly)))
        throw Error('NO_MUSICSCALE_CATALOG');
      setCatalog(parsed);
    }).catch(error=>{
      if(controller.signal.aborted || error?.name==='AbortError')return;
      setCatalog({});setCatalogError(true);
    }).finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false)});
    return ()=>controller.abort();
  },[refreshCount]);

  const formatPrice = (item?: CatalogProduct) => {
    if(!item)return null;
    const lang = i18n.resolvedLanguage || i18n.language || 'pt-BR';
    const locale = lang.startsWith('pt')?'pt-BR':lang.startsWith('es')?'es-ES':'en-US';
    try {return new Intl.NumberFormat(locale,{style:'currency',currency:item.currency.toUpperCase()}).format(item.price);}
    catch {return null;}
  };
  const discount = useMemo(() => {
    const m=catalog[tier]?.monthly, y=catalog[tier]?.yearly;
    return m&&y&&m.currency.toLowerCase()===y.currency.toLowerCase()
      ? catalogAnnualSavings(m.price,y.price):0;
  },[catalog,tier]);

  const proceed = () => {
    if(!canManageBilling || !selectedProduct || catalogLoading || loading)return;
    const hub=entitlementsService.getMillionsNestBaseUrl();
    if(isExistingSubscription) {
      window.location.assign(`${hub}/dashboard/billing`);
      return;
    }
    // Checkout verifies authenticated user/org and enforces duplicate-sub
    // protection server-side. The lookupKey is just a selected catalog item.
    const qs=new URLSearchParams({app:'musicscale',plan:selectedProduct.lookupKey});
    window.location.assign(`${hub}/checkout?${qs.toString()}`);
  };

  const tierFeatures: Record<MusicScalePlan,string[]> = {
    starter: [
      t('plans.features.starter.2','Músicas ilimitadas'),
      t('plans.features.starter.3','Escalas ilimitadas'),
      t('plans.limits.starter.1','Até 10 membros'),
    ],
    advanced: [
      t('plans.limits.advanced.1','Até 20 membros'),
      t('plans.features.advanced.3','Biblioteca Viva limitada'),
      t('plans.features.advanced.4','10 importações por mês'),
    ],
    pro: [
      t('plans.features.pro.2','Equipe ilimitada'),
      t('plans.features.pro.3','Biblioteca Viva completa'),
      t('plans.features.pro.6','Importação e organização com IA'),
    ]
  };
  return (
    <main data-testid="ms-canonical-plan-selector"
      className="min-h-full bg-[#050507] px-4 py-8 font-sans text-[#f7f7fa] sm:px-8">
      <div className="mx-auto max-w-[890px]">
        <header className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#3ed5dd]">{t('premium.planSelection.eyebrow')}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl">{t('premium.planSelection.title')}</h1>
          <p className="mt-3 text-sm leading-6 text-[#a6a6b2]">{t('premium.planSelection.subtitle')}</p>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-white/[0.08] bg-[#121218] p-4">
            <ShieldCheck className="h-6 w-6 shrink-0 text-[#3ed5dd]" aria-hidden="true" />
            <div><h2 className="text-xs font-semibold">{t('premium.planSelection.preserveTitle')}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#a6a6b2]">{t('premium.planSelection.preserveBody')}</p></div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-white/[0.08] bg-[#121218] p-4">
            <CreditCard className="h-6 w-6 shrink-0 text-[#4f8cff]" aria-hidden="true" />
            <div><h2 className="text-xs font-semibold">{t('premium.planSelection.billingTitle')}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#a6a6b2]">{t('premium.planSelection.billingBody')}</p></div>
          </div>
        </div>

        <div className="mt-6 flex w-fit max-w-full items-center gap-1 rounded-full border border-white/[0.09] bg-[#121218] p-1" role="group" aria-label={t('premium.planSelection.periodLabel')}>
          {(['monthly','yearly'] as CatalogCycle[]).map(c=>(
            <button key={c} type="button" aria-pressed={cycle===c} onClick={()=>setCycle(c)}
              className={`min-h-10 rounded-full px-6 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ed5dd] ${cycle===c?'bg-[#4f8cff] text-white':'text-[#a6a6b2] hover:text-white'}`}>
              {t(c==='monthly'?'premium.planSelection.monthly':'premium.planSelection.yearly')}
            </button>
          ))}
        </div>

        {catalogError && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-[#181820] p-4 text-xs text-amber-100">
          <span>{t('premium.planSelection.catalogError')}</span>
          <button type="button" onClick={()=>setRefreshCount(n=>n+1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-white/10">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />{t('premium.planSelection.retry')}
          </button>
        </div>}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3" role="radiogroup" aria-label={t('premium.planSelection.choosePlan')}>
          {TIERS.map(plan=>{
            const item=catalog[plan]?.[cycle];
            const selected=plan===tier;
            return (
              <button key={plan} type="button" role="radio" aria-checked={selected}
                onClick={()=>setTier(plan)}
                className={`relative min-w-0 rounded-[22px] border p-5 text-left transition-[border-color,background-color] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ed5dd] ${selected?'border-[#3ed5dd] bg-[#111b28]':'border-white/[0.10] bg-[#121218] hover:border-[#4f8cff]/50'}`}>
                {plan==='advanced' && <span className="mb-3 inline-block rounded-lg bg-[#4f8cff]/15 px-2 py-1 text-[10px] font-semibold text-[#9bbaff]">{t('premium.planSelection.recommended')}</span>}
                <h2 className="text-lg font-semibold capitalize">{plan==='pro'?'Pro':plan==='advanced'?'Advanced':'Starter'}</h2>
                <p className="mt-1 min-h-8 text-[11px] leading-4 text-[#a6a6b2]">{t(`premium.planSelection.description.${plan}`)}</p>
                <p className="mt-5 text-[26px] font-bold tracking-[-0.04em]">
                  {catalogLoading?'…':formatPrice(item)??t('premium.planSelection.unavailable')}
                </p>
                <p className="mt-1 text-[11px] text-[#a6a6b2]">{t(cycle==='monthly'?'premium.planSelection.perMonth':'premium.planSelection.perYear')}</p>
                <div className="my-4 h-px bg-white/[0.08]" />
                <ul className="space-y-3">
                  {tierFeatures[plan].map((feature,i)=>(
                    <li key={i} className="flex items-start gap-2 text-[11px] leading-5 text-[#e1e1ea]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3ed5dd]" aria-hidden="true"/>{feature}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[#a6a6b2]" role="status">
            {cycle==='yearly'&&discount>0
              ? t('premium.planSelection.savings',{count:discount})
              : t('premium.planSelection.verifiedCatalog')}
          </div>
          {canManageBilling ? <button type="button" onClick={proceed}
            disabled={!selectedProduct || catalogLoading || loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f8cff] to-[#3ed5dd] px-6 text-sm font-bold text-[#050507] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {t(isExistingSubscription?'premium.planSelection.manage':'premium.planSelection.continue')}
            <ArrowRight className="h-4 w-4" aria-hidden="true"/>
          </button> : <p className="text-xs text-[#a6a6b2]">{t('premium.planSelection.managerOnly')}</p>}
        </div>
        <p className="mt-4 text-center text-[11px] leading-5 text-[#a6a6b2]">{t('premium.planSelection.disclaimer')}</p>
      </div>
    </main>
  );
}
