import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import pt from '../packages/i18n/locales/pt';

interface PricingProps {
  onSelectPlan?: (planKey: string, billingCycle: 'monthly' | 'yearly') => void;
}

export const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const scopeTitle = t('landing:pricing_scope_title', t('landing.pricing_scope_title', pt.landing.pricing_scope_title));
  const scopeDesc = t('landing:pricing_scope_desc', t('landing.pricing_scope_desc', pt.landing.pricing_scope_desc));
  const scopeLabel = t('landing:pricing_scope_label', t('landing.pricing_scope_label', pt.landing.pricing_scope_label));

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      userLimit: 'Até 10 usuários',
      priceMonthly: 'R$ 49,90',
      priceYearly: 'R$ 39,90',
      periodMonthly: '/ mês',
      periodYearly: '/ mês (faturado anualmente)',
      lookupKeyMonthly: 'musicscale_starter_monthly',
      lookupKeyYearly: 'musicscale_starter_yearly',
      popular: false,
      features: [
        'Até 10 integrantes incluídos',
        'Gestão de escalas e repertório',
        'Cifras com transposição de tom',
        'Notificações de escala',
        'Teste grátis de 7 dias'
      ]
    },
    {
      id: 'advanced',
      name: 'Advanced',
      userLimit: 'Até 30 usuários',
      priceMonthly: 'R$ 89,90',
      priceYearly: 'R$ 69,90',
      periodMonthly: '/ mês',
      periodYearly: '/ mês (faturado anualmente)',
      lookupKeyMonthly: 'musicscale_advanced_monthly',
      lookupKeyYearly: 'musicscale_advanced_yearly',
      popular: true,
      features: [
        'Até 30 integrantes incluídos',
        'Todos os recursos do Starter',
        'Biblioteca Viva de Cifras',
        'Gestão de múltiplos eventos',
        'Suporte prioritário'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      userLimit: 'Até 100 usuários',
      priceMonthly: 'R$ 149,90',
      priceYearly: 'R$ 119,90',
      periodMonthly: '/ mês',
      periodYearly: '/ mês (faturado anualmente)',
      lookupKeyMonthly: 'musicscale_pro_monthly',
      lookupKeyYearly: 'musicscale_pro_yearly',
      popular: false,
      features: [
        'Até 100 integrantes incluídos',
        'Todos os recursos do Advanced',
        'IA de auxílio de repertório',
        'Relatórios e métricas de escala',
        'Gerente de conta dedicado'
      ]
    }
  ];

  const handlePurchase = (plan: typeof plans[0]) => {
    const lookupKey = billingCycle === 'yearly' ? plan.lookupKeyYearly : plan.lookupKeyMonthly;
    if (onSelectPlan) {
      onSelectPlan(lookupKey, billingCycle);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Planos e Preços
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
          Escolha o plano ideal para o tamanho do seu ministério. Todos os planos incluem 7 dias de teste gratuito sem compromisso.
        </p>

        {/* Destaque Centralizado de Escopo de Preço */}
        <div className="max-w-xl mx-auto my-6 bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-xl text-center space-y-2">
          <h3 className="text-base font-bold text-amber-400 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            {scopeTitle}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-medium">
            {scopeDesc}
          </p>
        </div>

        {/* Seletor Mensal / Anual */}
        <div className="inline-flex items-center bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Anual
            <span className="bg-amber-400/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
              Economize 20%
            </span>
          </button>
        </div>
      </div>

      {/* Cards de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
        {plans.map((plan) => {
          const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
          const period = billingCycle === 'yearly' ? plan.periodYearly : plan.periodMonthly;

          return (
            <div
              key={plan.id}
              className={`relative bg-zinc-900/70 border rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all hover:border-zinc-700 ${
                plan.popular
                  ? 'border-amber-500/60 shadow-2xl shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : 'border-zinc-800'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 text-xs font-bold px-3 py-1 rounded-full shadow-md">
                  Mais Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <span className="text-xs font-medium text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                    {plan.userLimit}
                  </span>
                </div>

                <div className="mt-4 mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white">{price}</span>
                    <span className="text-xs text-zinc-400 font-medium">{period}</span>
                  </div>

                  {/* Rótulo de Escopo de Preço em cada card */}
                  <div className="mt-2 text-xs font-semibold text-amber-400/90 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>{scopeLabel}</span>
                  </div>
                </div>

                <ul className="mt-6 space-y-3 border-t border-zinc-800/80 pt-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 text-sm text-zinc-300">
                      <span className="text-amber-400 font-bold">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handlePurchase(plan)}
                className={`mt-8 w-full py-3 px-4 rounded-xl font-semibold transition-all shadow-md ${
                  plan.popular
                    ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-500/10'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                Iniciar 7 Dias Grátis
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Pricing;
