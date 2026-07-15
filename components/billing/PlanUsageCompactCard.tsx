import React, { useState, useEffect } from 'react';
import { useMusicScaleEntitlements, useMusicScalePlan } from '../../hooks/useMusicScaleEntitlements';
import { useEcosystemAdmin } from '../../hooks/useEcosystemAdmin';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTranslation } from 'react-i18next';

export const PlanUsageCompactCard: React.FC = () => {
  const { entitlements, loading } = useMusicScaleEntitlements();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [membersCount, setMembersCount] = useState<number>(0);

  useEffect(() => {
    if (entitlements?.organizationId) {
      if (entitlements.usage.users !== undefined) {
          setMembersCount(entitlements.usage.users);
      } else {
          const q = collection(db, 'organizations', entitlements.organizationId, 'members');
          getCountFromServer(q).then(snap => {
            setMembersCount(snap.data().count);
          }).catch(console.error);
      }
    }
  }, [entitlements?.organizationId, entitlements?.usage.users]);

  if (loading || !entitlements) return null;

  const { plan, limits } = entitlements;
  
  const effectivePlan = isEcosystemAdmin ? 'pro' : plan;

  const renderBadge = () => {
    if (isEcosystemAdmin) {
      return (
        <span className="flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black text-[10px] uppercase font-bold tracking-widest leading-none">
          <ShieldCheck className="w-3 h-3" />
          {t("billing.global_access", "Acesso Global")}
        </span>
      );
    }
    switch(effectivePlan) {
      case 'pro': return <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] uppercase font-bold tracking-widest">PRO</span>;
      case 'advanced': return <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] uppercase font-bold tracking-widest border border-blue-500/20">ADVANCED</span>;
      default: return <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-widest">STARTER</span>;
    }
  };

  const renderStatusInfo = () => {
    const { status, currentPeriodEnd, trialEndsAt } = entitlements;
    
    // For global admin, we don't care about their org's strict status to block them, 
    // but we can show it subtly if we want, or simply say "Lifetime"
    if (isEcosystemAdmin) {
       return (
          <div className="flex flex-col sm:items-end">
            <div className="flex items-center gap-1.5 mb-0.5">
               <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500`} />
               <span className={`text-[13px] font-bold text-emerald-600 dark:text-emerald-400`}>{t("billing.lifetime_access", "Acesso Vitalício do Ecossistema")}</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-[#888] font-medium">{t("billing.all_features_unlocked", "Todos os recursos liberados")}</span>
          </div>
       );
    }
    let statusText = '';
    let statusColor = 'text-slate-500 dark:text-slate-400';
    let dotColor = 'bg-slate-400';
    
    switch (status) {
      case 'active':
        statusText = t('billing.statusActive');
        statusColor = 'text-emerald-600 dark:text-emerald-400/90';
        dotColor = 'bg-emerald-500/80';
        break;
      case 'trialing':
        statusText = t('billing.statusTrial');
        statusColor = 'text-blue-600 dark:text-blue-400';
        dotColor = 'bg-blue-500';
        break;
      case 'past_due':
        statusText = t('billing.statusPastDue');
        statusColor = 'text-amber-600 dark:text-amber-500';
        dotColor = 'bg-amber-500';
        break;
      case 'canceled':
        statusText = t('billing.statusCanceled');
        statusColor = 'text-red-500 dark:text-red-400';
        dotColor = 'bg-red-500';
        break;
      case 'expired':
        statusText = t('billing.statusExpired');
        statusColor = 'text-red-500 dark:text-red-400';
        dotColor = 'bg-red-500';
        break;
      case 'inactive':
        statusText = t('billing.statusInactive');
        statusColor = 'text-red-500 dark:text-red-400';
        dotColor = 'bg-red-500';
        break;
      case 'none':
        statusText = plan === 'free' || plan === 'starter' ? t('billing.freePlan') : t('billing.statusNone');
        statusColor = 'text-slate-500';
        dotColor = 'bg-slate-400';
        break;
    }

    let dateInfo = null;
    if (status === 'trialing' && trialEndsAt) {
       dateInfo = `${t('billing.endsOn')} ${new Date(trialEndsAt).toLocaleDateString()}`;
    } else if (status === 'active' && currentPeriodEnd) {
       dateInfo = `${t('billing.renewsOn')} ${new Date(currentPeriodEnd).toLocaleDateString()}`;
    } else if (status === 'canceled' && currentPeriodEnd) {
       dateInfo = `${t('billing.endsOn')} ${new Date(currentPeriodEnd).toLocaleDateString()}`;
    } else if ((plan === 'free' || plan === 'starter') && !currentPeriodEnd) {
       dateInfo = t('billing.lifetimeAccess');
    }

    return (
      <div className="flex flex-col sm:items-end">
        <div className="flex items-center gap-1.5 mb-0.5">
           <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
           <span className={`text-[13px] font-bold ${statusColor}`}>{statusText}</span>
        </div>
        {dateInfo && (
           <span className="text-[11px] text-slate-500 dark:text-[#888] font-medium">{dateInfo}</span>
        )}
      </div>
    );
  };

  const memberStr = membersCount === 1 ? t('billing.member', 'membro') : t('billing.members', 'membros');
  const usersText = isEcosystemAdmin || limits.users === -1 ? `${membersCount} ${memberStr}` : `${membersCount}/${limits.users} ${memberStr}`;

  return (
    <div 
      onClick={() => navigate('/plan-usage')}
      className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-[24px] bg-white dark:bg-[#111111] border border-black/[0.05] dark:border-white/[0.05] shadow-sm md:hover:shadow-md cursor-pointer transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 items-center justify-center text-indigo-500">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[15px] font-bold text-slate-900 dark:text-white leading-none">{t('billing.currentPlan')}</h4>
            {renderBadge()}
          </div>
          <p className="text-[13px] text-slate-500 dark:text-[#888] font-medium flex items-center gap-2">
            <span>{usersText}</span>
            {effectivePlan === 'starter' && (
               <>
                 <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                 <span>{t('billing.liveLibraryBlocked')}</span>
               </>
            )}
            {effectivePlan !== 'pro' && !isEcosystemAdmin && (
               <>
                 <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                 <span>{t('billing.unlockedInPro')}</span>
               </>
            )}
          </p>
        </div>
      </div>
      <div className="flex w-full sm:w-auto flex-col sm:items-end justify-between sm:justify-center gap-3 sm:gap-2">
        <div className="flex flex-col sm:items-end">
           {renderStatusInfo()}
        </div>
        <div className="flex items-center gap-2 text-indigo-500 font-semibold text-[13px] bg-indigo-50/50 dark:bg-white/[0.02] sm:bg-transparent px-4 py-2 sm:p-0 rounded-2xl sm:rounded-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {t('billing.viewUsageDetails')}
          <ChevronRight className="w-4 h-4 transition-transform md:group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
};
