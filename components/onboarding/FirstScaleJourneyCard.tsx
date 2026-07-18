import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useFirstScaleExperience } from '../../hooks/useFirstScaleExperience';
import { useTranslation } from 'react-i18next';
import { useEcosystem } from '../../contexts/EcosystemContext';
import { useAuth } from '../../contexts/AuthContext';
import { useModals } from '../../contexts/ModalContext';
import { useMusicScaleFeature } from '../../hooks/useMusicScaleEntitlements';
import { useCapability } from '../../hooks/useCapability';
import { Music, Calendar, Users, Send, CheckCircle2, Lock, Wand2, Library, Plus } from 'lucide-react';

const LockedActionButton = ({ featureKey, requiredPlan, label, icon: Icon, onClick }: { featureKey: string, requiredPlan: string, label: string, icon: React.ReactNode, onClick: () => void }) => {
  const hasAccess = useMusicScaleFeature(featureKey as any);
  if (hasAccess) {
    return (
      <button
        onClick={onClick}
        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.1] transition-all text-sm font-medium text-zinc-300"
      >
        {Icon}
        {label}
      </button>
    );
  }
  
  return (
    <button
      disabled
      className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03] text-sm font-medium text-zinc-600 cursor-not-allowed relative group overflow-hidden"
    >
      <div className="absolute right-0 top-0 w-8 h-8 bg-gradient-to-bl from-zinc-800 to-transparent pointer-events-none flex items-start justify-end p-1.5 opacity-50">
         <Lock className="w-3 h-3 text-zinc-500" />
      </div>
      {Icon}
      {label}
      <span className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold uppercase tracking-widest text-indigo-400">
        {requiredPlan}
      </span>
    </button>
  );
}

export function FirstScaleJourneyCard() {
  const { 
    isEligible, 
    isLoading, 
    isCompleted, 
    currentEssentialStep, 
    completedEssentialSteps, 
    totalEssentialSteps, 
    milestones, 
    draftScale, 
    hasTeam 
  } = useFirstScaleExperience();
  
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { publishEvent: trackEvent } = useEcosystem();
  const { organization } = useAuth();
  const { openScaleForm, openSongForm, openAiSongImport } = useModals();
  const { hasCapability } = useCapability();
  const canManageMembers = hasCapability('musicscale.members.manage');
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoading && isEligible && !isCompleted && organization) {
      const key = `${organization.id}_${currentEssentialStep}_${completedEssentialSteps}`;
      if (viewedRef.current !== key) {
        trackEvent({ 
          type: 'telemetry', 
          payload: { 
            action: 'musicscale_first_value_journey_viewed', 
            journeyVersion: 1,
            currentStep: currentEssentialStep, 
            completedEssentialSteps,
            hasTeam,
            hasDraft: !!draftScale,
            organizationId: organization.id 
          }, 
          timestamp: Date.now() 
        });
        viewedRef.current = key;
      }
    }
  }, [isLoading, isEligible, isCompleted, currentEssentialStep, completedEssentialSteps, hasTeam, draftScale, organization, trackEvent]);

  if (isLoading || isCompleted || !isEligible || !currentEssentialStep) {
    return null;
  }

  const handleAction = (actionId: string, handler: () => void) => {
    trackEvent({ 
      type: 'telemetry', 
      payload: { 
        action: 'musicscale_first_value_action_clicked', 
        actionId,
        journeyVersion: 1,
        currentStep: currentEssentialStep, 
        organizationId: organization?.id 
      }, 
      timestamp: Date.now() 
    });
    handler();
  };

  const getMilestoneIcon = (id: string) => {
    switch(id) {
      case 'repertoire': return <Music className="w-4 h-4" />;
      case 'firstScale': return <Calendar className="w-4 h-4" />;
      case 'team': return <Users className="w-4 h-4" />;
      case 'publish': return <Send className="w-4 h-4" />;
      default: return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getMilestoneLabel = (id: string) => t(`firstValueJourney.milestone${id.charAt(0).toUpperCase() + id.slice(1)}`);

  const renderContent = () => {
    switch (currentEssentialStep) {
      case 'repertoire':
        return (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                {t('firstValueJourney.repertoireTitle')}
              </h2>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                {t('firstValueJourney.repertoireDescription')}
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => handleAction('starterPack', () => navigate('/songs?starterPack=1'))}
                className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:px-6 md:py-4 rounded-xl bg-white hover:bg-zinc-100 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <div>
                  <div className="font-bold text-zinc-900 text-[15px]">{t('firstValueJourney.starterPackAction')}</div>
                  <div className="text-zinc-600 text-[13px]">{t('firstValueJourney.starterPackHelper')}</div>
                </div>
                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900/5 text-zinc-900">
                  <Music className="w-5 h-5" />
                </div>
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAction('manual', openSongForm)}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.1] transition-all text-sm font-medium text-zinc-300"
                >
                  <Plus className="w-4 h-4" />
                  {t('firstValueJourney.manualAction')}
                </button>
                <LockedActionButton 
                  featureKey="aiImport" 
                  requiredPlan="Pro" 
                  label={t('firstValueJourney.aiAction')} 
                  icon={<Wand2 className="w-4 h-4" />} 
                  onClick={() => handleAction('aiImport', openAiSongImport)} 
                />
                <LockedActionButton 
                  featureKey="libraryAccess" 
                  requiredPlan="Advanced" 
                  label={t('firstValueJourney.libraryAction')} 
                  icon={<Library className="w-4 h-4" />} 
                  onClick={() => handleAction('library', () => navigate('/library'))} 
                />
              </div>
            </div>
          </div>
        );
      case 'firstScale':
        return (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                {t('firstValueJourney.firstScaleTitle')}
              </h2>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                {t('firstValueJourney.firstScaleDescription')}
              </p>
            </div>
            <div>
              <button
                onClick={() => handleAction('createScale', openScaleForm)}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {t('firstValueJourney.createScaleAction')}
              </button>
            </div>
          </div>
        );
      case 'publish':
        return (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                {t('firstValueJourney.publishTitle')}
              </h2>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                {t('firstValueJourney.publishDescription')}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={() => handleAction('continueDraft', () => {
                  if (draftScale?.id) navigate(`/scales/${draftScale.id}`);
                  else navigate('/scales');
                })}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {t('firstValueJourney.continueDraftAction')}
              </button>
              
              {!hasTeam && canManageMembers && (
                <div className="flex flex-col w-full sm:w-auto">
                  <button
                    onClick={() => handleAction('addTeam', () => navigate('/users'))}
                    className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors text-center"
                  >
                    {t('firstValueJourney.addTeamAction')}
                  </button>
                  <span className="text-[11px] text-zinc-500 text-center sm:text-left sm:pl-6">{t('firstValueJourney.teamOptionalHelper')}</span>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-8 p-6 md:p-8 rounded-[24px] bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/[0.06] shadow-2xl overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.02]" />
        <div 
          className="absolute top-0 left-0 h-1 bg-indigo-500 transition-all duration-700 ease-out rounded-r-full" 
          style={{ width: `${(completedEssentialSteps / totalEssentialSteps) * 100}%` }}
        />

        <div className="mb-8">
          <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-400 mb-1">
            {t('firstValueJourney.title')}
          </div>
          <div className="text-[13px] text-zinc-400">
            {t('firstValueJourney.progress', { current: completedEssentialSteps, total: totalEssentialSteps })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          
          <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-4 md:pb-0 scrollbar-hide">
            {milestones.map((m, idx) => {
              const isCompleted = m.status === 'completed';
              const isCurrent = m.status === 'current';
              const isOptional = m.status === 'optional';
              
              return (
                <div key={m.id} className={`flex items-center gap-3 shrink-0 ${isCompleted ? 'opacity-50' : (isCurrent ? 'opacity-100' : 'opacity-40')} transition-opacity`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted ? 'bg-indigo-500/20 text-indigo-400' : 
                    (isCurrent ? 'bg-white text-zinc-900 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-white/[0.05] text-zinc-400')
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : getMilestoneIcon(m.id)}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[13px] font-bold ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                      {getMilestoneLabel(m.id)}
                    </span>
                    {isOptional && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {t('firstValueJourney.statusOptional')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
