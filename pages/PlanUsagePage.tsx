import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMusicScalePlan, useMusicScaleUsage, useMusicScaleFeature } from '../hooks/useMusicScaleEntitlements';
import { PLAN_PRICING_DETAILS } from '../lib/limits';
import { UsageMeterCard } from '../components/billing/UsageMeterCard';
import { entitlementsService } from '../services/entitlementsService';
import { Users, Library, Sparkles, Copy, LifeBuoy, ArrowUpCircle } from 'lucide-react';

export default function PlanUsagePage() {
  const { organization } = useAuth();
  const { plan, status, loading: planLoading } = useMusicScalePlan();
  const { usage, limits, loading: usageLoading } = useMusicScaleUsage();
  
  const hasAi = useMusicScaleFeature('aiImport');
  const hasCloning = useMusicScaleFeature('scaleCloning');
  const hasLibrary = useMusicScaleFeature('libraryAccess');
  const hasPrioritySupport = useMusicScaleFeature('priorityNewFeatures'); // Use a proxy for premium
  
  const planDetails = PLAN_PRICING_DETAILS[plan || 'starter'];
  const loading = planLoading || usageLoading;

  const handleManageBilling = () => {
    const url = entitlementsService.getMillionsNestBaseUrl();
    window.open(`${url}/dashboard/billing`, '_blank', 'noreferrer,noopener');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-black font-sans">
        <div className="pt-24 max-w-7xl mx-auto px-4 sm:px-8">
          <div className="animate-pulse bg-white/40 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 h-64 rounded-[32px]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans pb-24">
      <div className="pt-8 pb-8 max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase text-xs mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Uso do Plano
              </p>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-4">
                Meu Plano
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl font-medium">
                Gerencie seus limites, acompanhe o consumo da organização e descubra os recursos disponíveis para impulsionar seu ministério.
              </p>
            </div>
            <div className="flex gap-3">
              {plan !== 'pro' && (
                <button
                  onClick={handleManageBilling}
                  className="px-6 py-3 rounded-2xl text-[13px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Fazer Upgrade
                </button>
              )}
              <button
                onClick={handleManageBilling}
                className="px-6 py-3 rounded-2xl text-[13px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-[#1A1A1C] dark:text-slate-300 dark:border-white/[0.08] dark:hover:bg-white/10 transition-all"
              >
                Gerenciar Assinatura
              </button>
            </div>
          </div>
        </div>

        {/* Current Plan Overview Card */}
        <div className="bg-white dark:bg-[#111111] rounded-[2rem] border border-black/[0.06] dark:border-white/[0.06] shadow-sm overflow-hidden mb-8">
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center border-4 ${
                plan === 'pro' ? 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 shadow-lg shadow-indigo-500/10' :
                plan === 'advanced' ? 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' :
                'border-slate-100 bg-slate-50 text-slate-600 dark:border-white/5 dark:bg-white/5 dark:text-slate-300'
              }`}>
                {plan === 'pro' ? <Sparkles className="w-10 h-10" /> : plan === 'advanced' ? <ArrowUpCircle className="w-10 h-10" /> : <Users className="w-10 h-10" />}
              </div>
              <div>
                <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1.5">Organização Atual</h3>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
                  {organization?.name || 'Minha Igreja'}
                  <span className={`text-[11px] px-3 py-1 rounded-full uppercase tracking-widest border ${
                    plan === 'pro' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' :
                    plan === 'advanced' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                    'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                  }`}>
                    Plano {planDetails?.name}
                  </span>
                </h2>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                  Status: <span className="text-zinc-800 dark:text-zinc-200 font-bold uppercase">{status === 'active' || status === 'trialing' ? 'Ativo' : status}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-6 mt-12 px-2">Limites e Recursos</h3>
        
        {/* Usage Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <UsageMeterCard
            title="Usuários da Organização"
            icon={<Users className="w-5 h-5" />}
            used={usage?.users ?? 1}
            limit={limits?.users === -1 ? 'unlimited' : (limits?.users || 10)}
            ctaLabel={plan !== 'pro' ? "Adicionar mais usuários" : undefined}
            description={plan === 'pro' ? "Equipe ilimitada para todos os ministérios." : `Gerencie até ${limits?.users || 10} membros ativos.`}
          />

          <UsageMeterCard
            title="Importações da Biblioteca Viva"
            icon={<Library className="w-5 h-5" />}
            used={usage?.libraryImports || 0}
            limit={limits?.libraryImportsPerMonth === -1 ? 'unlimited' : (limits?.libraryImportsPerMonth || 0)}
            status={!hasLibrary ? 'locked' : undefined}
            ctaLabel={!hasLibrary ? "Liberar Biblioteca Viva" : plan !== 'pro' ? "Liberar importações ilimitadas" : undefined}
            description={!hasLibrary 
              ? "Traga músicas prontas com cifras perfeitamente estruturadas. Requer Advanced." 
              : plan === 'pro' 
                ? "Prepare repertórios sem limites com o acervo global MusicScale." 
                : "Seu consumo zera todo mês."}
          />

          <UsageMeterCard
            title="IA para Estruturação"
            icon={<Sparkles className="w-5 h-5" />}
            limit={hasAi ? 'unlimited' : undefined}
            status={hasAi ? 'unlimited' : 'locked'}
            used={0}
            ctaLabel={!hasAi ? "Experimentar Ferramentas com IA" : undefined}
            description="Automatize a estruturação de músicas, extraia cifras diretamente das letras e receba sugestões."
          />

          <UsageMeterCard
            title="Clonagem de Escalas"
            icon={<Copy className="w-5 h-5" />}
            limit={hasCloning ? 'unlimited' : undefined}
            status={hasCloning ? 'unlimited' : 'locked'}
            used={0}
            ctaLabel={!hasCloning ? "Liberar Ferramentas de Equipe" : undefined}
            description="Replique bandas inteiras, escalas e horários em um único clique."
          />

          <UsageMeterCard
            title="Suporte Avançado"
            icon={<LifeBuoy className="w-5 h-5" />}
            limit={hasPrioritySupport ? 'unlimited' : undefined}
            status={hasPrioritySupport ? 'unlimited' : 'locked'}
            used={0}
            description="Fila de atendimento rápida diretamente no time de suporte da plataforma."
          />
        </div>

      </div>
    </div>
  );
}
