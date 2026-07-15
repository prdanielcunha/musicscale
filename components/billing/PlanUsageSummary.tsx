import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusicScalePlan, useMusicScaleUsage, useMusicScaleFeature } from '../../hooks/useMusicScaleEntitlements';
import { PLAN_PRICING_DETAILS } from '../../lib/limits';
import { UsageMeterCard } from './UsageMeterCard';
import { Users, Library, Sparkles, Copy, CalendarRange } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PlanUsageSummary() {
  const { plan, status, loading: planLoading } = useMusicScalePlan();
  const { usage, limits, loading: usageLoading } = useMusicScaleUsage();
  
  const hasAi = useMusicScaleFeature('aiImport');
  const hasCloning = useMusicScaleFeature('scaleCloning');
  const hasLibrary = useMusicScaleFeature('libraryAccess');
  
  // Basic info
  const planDetails = PLAN_PRICING_DETAILS[plan || 'starter'];
  
  const loading = planLoading || usageLoading;

  if (loading) {
    return (
      <div className="animate-pulse bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 h-64"></div>
    );
  }
  
  // Safe members metric using limits and usage if provided natively, or local users if calculated elsewhere
  // Actually we need `useAuth().organizationMembers` if it's there, but we only have `limits.users` 
  const usersUsed = usage?.users || 1; // Assuming 1 if not fully tracked in backend yet, will adapt if backend tracks it

  return (
    <div className="bg-white dark:bg-[#111111] border border-black/[0.06] dark:border-white/[0.06] rounded-[2rem] overflow-hidden shadow-sm">
      {/* Header Area */}
      <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Uso do Plano</h2>
            <div className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
              plan === 'pro' 
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
                : plan === 'advanced'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10'
            }`}>
              {planDetails?.name || 'Starter'}
            </div>
            
            {status !== 'active' && status !== 'trialing' && status !== 'none' && (
              <div className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                {status}
              </div>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Acompanhe seus limites, uso atual e recursos disponíveis na organização.
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <Link 
            to="/plan-usage" 
            className="h-10 px-4 flex items-center justify-center rounded-xl text-[13px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-[#1A1A1C] dark:text-slate-300 dark:border-white/[0.08] dark:hover:bg-white/10 dark:hover:text-white transition-all shadow-sm"
          >
            Ver Detalhes do Plano
          </Link>
        </div>
      </div>
      
      {/* Grid of Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 p-4 md:p-6 gap-4 bg-slate-50/50 dark:bg-black/20">
        
        {/* Users */}
        <UsageMeterCard
          title="Membros da Equipe"
          icon={<Users className="w-5 h-5" />}
          limit={limits?.users === -1 ? 'unlimited' : limits?.users || 10}
          used={usage?.users ?? 1} 
          ctaLabel={plan !== 'pro' ? 'Expandir limite de membros' : undefined}
          description={plan === 'pro' ? 'Expanda sua equipe livremente.' : `Seu plano atual permite cadastrar até ${limits?.users || 10} membros ativos.`}
        />

        {/* Library Imports */}
        <UsageMeterCard
          title="Biblioteca Viva"
          icon={<Library className="w-5 h-5" />}
          limit={limits?.libraryImportsPerMonth === -1 ? 'unlimited' : limits?.libraryImportsPerMonth || 0}
          used={usage?.libraryImports || 0}
          status={!hasLibrary ? 'locked' : undefined}
          ctaLabel={!hasLibrary ? 'Liberar Biblioteca Viva' : plan !== 'pro' ? 'Liberar importações ilimitadas' : undefined}
          description={!hasLibrary 
            ? 'Importe músicas completas a partir do plano Advanced.' 
            : plan === 'pro' 
              ? 'Importações ilimitadas do acervo global.' 
              : 'Você está no limite mensal do plano Advanced.'
          }
        />

        {/* AI Limit / State */}
        <UsageMeterCard
          title="Importação Inteligente (IA)"
          icon={<Sparkles className="w-5 h-5" />}
          limit={hasAi ? 'unlimited' : undefined}
          status={hasAi ? 'unlimited' : 'locked'}
          used={0}
          ctaLabel={!hasAi ? 'Liberar IA no Pro' : undefined}
          description="Estruturação automática de cifra, letra e tom."
        />
        
        {/* Cloning */}
        <UsageMeterCard
          title="Clonagem de Escalas"
          icon={<Copy className="w-5 h-5" />}
          limit={hasCloning ? 'unlimited' : undefined}
          status={hasCloning ? 'unlimited' : 'locked'}
          used={0}
          ctaLabel={!hasCloning ? 'Liberar Clonagem no Pro' : undefined}
          description="Duplique escalas inteiras num único clique."
        />

      </div>
    </div>
  );
}
