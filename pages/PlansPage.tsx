import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Sparkles, Zap, Shield, Check, ExternalLink } from 'lucide-react';
import { useMusicScaleEntitlements, useMusicScalePlan, useMusicScaleUsage } from '../hooks/useMusicScaleEntitlements';
import { entitlementsService, MusicScalePlan } from '../services/entitlementsService';
import { PLAN_PRICING_DETAILS } from '../lib/limits';
import { PremiumBadge, UsageLimitBanner } from '../components/premium/EntitlementGates';
import Card from '../components/common/Card';
import Tag from '../components/common/Tag';

const PlansPage: React.FC = () => {
  const { t } = useTranslation();
  const { entitlements, loading, refresh } = useMusicScaleEntitlements();
  const { plan: currentPlan, status } = useMusicScalePlan();
  const { usage, limits } = useMusicScaleUsage();

  if (loading) {
    return (
      <div className="flex bg-[#F8FAFC] dark:bg-[#0A0A0B] h-[50vh] w-full justify-center items-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  // Handle redirect to MillionsNest Centralized Billing Hub
  const handleRedirectToBilling = () => {
    try {
      const baseUrl = entitlementsService.getMillionsNestBaseUrl();
      entitlementsService.logAnalytics('billing_hub_clicked', {
        organizationId: entitlements?.organizationId || '',
        plan: currentPlan,
      });
      window.open(`${baseUrl}/dashboard/billing`, '_blank', 'noreferrer,noopener');
    } catch (e) {
      window.open('https://millionsnest.com/dashboard/musicscale/plans', '_blank');
    }
  };

  const planOptions: {
    id: MusicScalePlan;
    name: string;
    price: string;
    description: string;
    badge_label?: string;
    features: string[];
    limitsText: string[];
  }[] = [
    {
      id: 'starter',
      name: t('plans.starter.title_label', 'Starter'),
      price: t('plans.starter.price_val', 'R$ 19,90'),
      description: t('plans.starter.description_val', 'Plano de entrada para ministérios iniciando a organização profissional de suas escalas.'),
      features: [
        t('plans.features.starter.1', 'Até 10 usuários ativos na organização'),
        t('plans.features.starter.2', 'Músicas ilimitadas no repertório'),
        t('plans.features.starter.3', 'Escalas ilimitadas e calendário'),
        t('plans.features.starter.4', 'Letras, cifras, tom e BPM'),
        t('plans.features.starter.5', 'Compartilhamento de escalas'),
        t('plans.features.starter.6', 'Leitor simplificado (Mobile, Tablet, Desktop)'),
        t('plans.features.starter.7', 'Sincronização na nuvem em tempo real'),
        t('plans.features.starter.8', 'Sem Biblioteca Viva'),
        t('plans.features.starter.9', 'Sem Inteligência Artificial (IA)'),
        t('plans.features.starter.10', 'Sem clonagem de escalas'),
        t('plans.features.starter.11', 'Sem histórico completo'),
        t('plans.features.starter.12', 'Sem personalização avançada'),
        t('plans.features.starter.13', 'Suporte padrão por e-mail'),
      ],
      limitsText: [
        t('plans.limits.starter.1', 'Até 10 membros ativos na equipe'),
        t('plans.limits.starter.2', 'Sem acesso à Biblioteca Viva'),
        t('plans.limits.starter.3', 'Suporte padrão por e-mail'),
      ],
    },
    {
      id: 'advanced',
      name: t('plans.advanced.title_label', 'Advanced'),
      price: t('plans.advanced.price_val', 'R$ 29,90'),
      description: t('plans.advanced.description_val', 'Plano intermediário para equipes em crescimento que desejam o acervo da Biblioteca Viva.'),
      features: [
        t('plans.features.advanced.1', 'Tudo do plano Starter'),
        t('plans.features.advanced.2', 'Até 20 usuários ativos na organização'),
        t('plans.features.advanced.3', 'Biblioteca Viva limitada'),
        t('plans.features.advanced.4', '10 importações de cifras do acervo por mês'),
        t('plans.features.advanced.5', 'Histórico completo de escalas e repertório'),
        t('plans.features.advanced.6', 'Personalização avançada de repertório (campo harmônico, tons)'),
        t('plans.features.advanced.7', 'Visualização especial multi-bandas'),
        t('plans.features.advanced.8', 'Sem Inteligência Artificial (IA)'),
        t('plans.features.advanced.9', 'Sem clonagem de escalas'),
        t('plans.features.advanced.10', 'Sem importações ilimitadas'),
        t('plans.features.advanced.11', 'Suporte prioritário básico'),
      ],
      limitsText: [
        t('plans.limits.advanced.1', 'Até 20 membros ativos na equipe'),
        t('plans.limits.advanced.2', '10 importações/mês da Biblioteca Viva'),
        t('plans.limits.advanced.3', 'Suporte prioritário no ecossistema'),
      ],
    },
    {
      id: 'pro',
      name: t('plans.pro.title_label', 'Pro'),
      price: t('plans.pro.price_val', 'R$ 34,90'),
      description: t('plans.pro.description_val', 'Preço de lançamento. O potencial máximo com inteligência artificial e capacidade ilimitada.'),
      badge_label: t('plans.pro.badge_val', 'Lançamento'),
      features: [
        t('plans.features.pro.1', 'Tudo do plano Advanced'),
        t('plans.features.pro.2', 'Usuários / Membros ilimitados na equipe'),
        t('plans.features.pro.3', 'Biblioteca Viva completa e acervo integrado'),
        t('plans.features.pro.4', 'Importações ilimitadas da Biblioteca Viva'),
        t('plans.features.pro.5', 'Importação inteligente com IA musical'),
        t('plans.features.pro.6', 'Estruturação automática de letra, cifra, tom e BPM'),
        t('plans.features.pro.7', 'Sugestões inteligentes para repertório e escalas'),
        t('plans.features.pro.8', 'Insights dinâmicos de fluxo do culto (IA)'),
        t('plans.features.pro.9', 'Clonagem de escalas em um toque'),
        t('plans.features.pro.10', 'Recursos futuros premium'),
        t('plans.features.pro.11', 'Suporte prioritário personalizado'),
      ],
      limitsText: [
        t('plans.limits.pro.1', 'Membros ilimitados na equipe'),
        t('plans.limits.pro.2', 'Importações ilimitadas da Biblioteca Viva'),
        t('plans.limits.pro.3', 'Inteligência Artificial (IA) liberada'),
      ],
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#0A0A0B] overflow-y-auto overflow-x-hidden selection:bg-indigo-500/10 font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-10 py-6">
        
        {/* Editorial Heading */}
        <div className="text-center md:text-left max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800/60 text-slate-800 dark:text-zinc-300 text-xs font-semibold uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
            {t("plans.license_settings", "Configurações de Licença")}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
            {t("plans.plans_and_limits", "Planos e Limites do Ministério")}
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-zinc-400">
            {t("plans.subtitle", "Sua assinatura e faturamento são gerenciados centralizadamente pela plataforma MillionsNest, garantindo total conformidade, segurança e facilidade nos pagamentos.")}
          </p>
        </div>

        {/* Dynamic Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-sm flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block">{t("plans.active_license", "Licenciamento Ativo")}</span>
                <PremiumBadge className="py-1 px-2.5 text-xs" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 capitalize">
                  MusicScale {currentPlan}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {status === 'active' || status === 'trialing' 
                    ? t('plans.billing_active', 'Seu faturamento está regularizado. Todos os recursos liberados para sua faixa estão operacionais.') 
                    : status === 'past_due' 
                      ? t('plans.billing_past_due', 'Seu pagamento está pendente no MillionsNest. Acesse a plataforma de cobrança imediata para evitar bloqueios.')
                      : t('plans.billing_inactive', 'O licenciamento desta organização está inativo ou suspenso.')}
                </p>
              </div>

              {entitlements?.currentPeriodEnd && (
                <div className="text-xs text-zinc-400">
                  {t('plans.next_renewal', 'Próxima renovação em:')}{' '}
                  <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                    {new Date(entitlements.currentPeriodEnd).toLocaleDateString(navigator.language)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
              <button
                onClick={handleRedirectToBilling}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 shadow-sm transition-all cursor-pointer"
              >
                <span>{t("plans.billing_changes", "Fazer Alterações no MillionsNest")}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              
              <button 
                onClick={() => refresh()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
              >
                {t("plans.sync_license", "Sincronizar Licença")}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest block">{t("plans.library_billing", "Consumo da Biblioteca")}</span>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{t("plans.import_control", "Controle de Importação")}</h3>
              <p className="text-xs text-zinc-500">
                {t("plans.library_billing_desc", "Músicas copiadas diretamente da biblioteca ativa exigem limites de importação mensal de acordo com seu plano.")}
              </p>
            </div>
            
            <UsageLimitBanner featureKey="libraryAccess" />
          </div>
        </div>

        {/* 3 Column Presentation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {planOptions.map((opt) => {
            const isCurrent = opt.id === currentPlan;
            const detail = PLAN_PRICING_DETAILS[opt.id];

            return (
              <div
                key={opt.id}
                className={`flex flex-col justify-between rounded-3xl border p-6 bg-white dark:bg-zinc-900 relative transition-all duration-300 ${
                  opt.id === 'pro'
                    ? 'border-indigo-500 shadow-2xl shadow-indigo-500/20 dark:border-indigo-400 scale-[1.02] lg:scale-[1.06] z-10 before:absolute before:inset-0 before:-z-10 before:rounded-3xl before:bg-gradient-to-b before:from-indigo-500/5 before:to-purple-500/5'
                    : isCurrent 
                      ? 'border-indigo-600 ring-1 ring-indigo-600 dark:border-indigo-500 dark:ring-indigo-500 shadow-sm' 
                      : 'border-zinc-200/80 dark:border-zinc-800/80 shadow-sm'
                }`}
              >
                {opt.id === 'pro' && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center z-20">
                    <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/30 flex items-center gap-1.5 ring-1 ring-white/20">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" /> {t("plans.recommended_sold", "RECOMENDADO E MAIS VENDIDO")}
                    </span>
                  </div>
                )}

                {isCurrent && opt.id !== 'pro' && (
                  <span className="absolute -top-3 right-6 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full z-20">
                    {t("plans.current_plan", "Seu Plano Atual")}
                  </span>
                )}
                {isCurrent && opt.id === 'pro' && (
                  <span className="absolute top-4 right-4 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50 z-20">
                    {t("common.active", "Ativo")}
                  </span>
                )}

                <div className="space-y-6">
                  <div>
                    {opt.id === 'pro' && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/30 inline-flex items-center gap-1">
                        <Crown className="w-3 h-3" /> {detail.badge}
                      </span>
                    )}
                    {opt.id === 'advanced' && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-900/30">
                        {detail.badge}
                      </span>
                    )}
                    {opt.id === 'starter' && (
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800/40 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700/60">
                        {detail.badge}
                      </span>
                    )}

                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-3">{opt.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1.5 h-10 leading-relaxed">{opt.description}</p>
                  </div>

                  {/* Pricing Display */}
                  <div className="border-t border-b border-zinc-100 dark:border-zinc-800/80 py-4 flex flex-col gap-0.5 justify-center">
                    {opt.id === 'pro' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500 line-through">{t("plans.pro_original_price", "De R$ 39,90")}</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">{t("plans.launch_promo", "Lançamento")}</span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-extrabold tracking-tight ${opt.id === 'pro' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-50'}`}>
                        {opt.price}
                      </span>
                      <span className="text-xs text-zinc-500 font-medium">{t("plans.per_month", "/mês")}</span>
                    </div>
                  </div>

                  {/* Feature lists */}
                  <div className="space-y-4">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">{t("plans.included_features", "Recursos Inclusos:")}</span>
                    <ul className="space-y-2.5">
                      {opt.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-600 dark:text-zinc-400 leading-tight">
                          <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${opt.id === 'pro' ? 'text-indigo-500 font-bold' : 'text-indigo-600/70 dark:text-indigo-400/70'}`} />
                          <span className={opt.id === 'pro' && idx > 3 ? 'font-medium text-zinc-800 dark:text-zinc-200' : ''}>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Limit checks */}
                  <div className="space-y-2.5 pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                    <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">{t("plans.plan_limits", "Limites do Plano:")}</span>
                    <ul className="space-y-2">
                      {opt.limitsText.map((lim, idx) => (
                        <li key={idx} className="text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${opt.id === 'pro' ? 'bg-indigo-400' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                          <span className={opt.id === 'pro' ? 'font-medium' : ''}>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8">
                  {!isCurrent ? (
                    <button
                      onClick={handleRedirectToBilling}
                      className={opt.id === 'pro' 
                        ? "w-full py-3.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-600/25 transition-all text-center cursor-pointer flex items-center justify-center gap-2 relative overflow-hidden group" 
                        : "w-full py-2.5 rounded-xl text-xs font-semibold border border-zinc-200 hover:border-indigo-600 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-1 cursor-pointer"}
                    >
                      {opt.id === 'pro' && (
                        <span className="absolute inset-0 w-full h-full bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                      )}
                      <span className="relative z-10">{opt.id === 'pro' ? t("plans.upgrade_pro", "FAZER UPGRADE PARA PRO") : t("plans.change_to_plan", "Mudar para {{name}}", { name: opt.name })}</span>
                    </button>
                  ) : (
                    <div className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center gap-1.5 cursor-not-allowed">
                      <Check className="w-3.5 h-3.5" />
                      {t("plans.active_on_org", "Ativo na Organização")}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
        
      </div>
    </div>
  );
};

export default PlansPage;
