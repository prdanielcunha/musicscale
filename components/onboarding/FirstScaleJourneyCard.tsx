import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useFirstScaleExperience } from '../../hooks/useFirstScaleExperience';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useModals } from '../../contexts/ModalContext';
import { useCapability } from '../../hooks/useCapability';
import { Music, Calendar, Users, CheckCircle2, Lock, Wand2, Library, Plus, ChevronRight } from 'lucide-react';
import { LockedActionButton } from '../billing/LockedActionButton';

export function FirstScaleJourneyCard({ journey: propJourney }: { journey?: any }) {
  const fallbackJourney = useFirstScaleExperience();
  const journey = propJourney || fallbackJourney;
  
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
  } = journey;

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { openSongForm, openScaleForm, openAiSongImport } = useModals();
  const { hasCapability } = useCapability();
  const canManageMembers = hasCapability('musicscale.members.manage');

  if (isLoading || !isEligible || isCompleted || !currentEssentialStep) return null;

  const handleAction = (actionId: string, callback: () => void) => {
    callback();
  };

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
            
            <div className="space-y-6">
              {/* Recommended Action */}
              <button
                onClick={() => handleAction('starterPack', () => navigate('/songs?starterPack=1', { state: { starterRepertoireOrigin: 'first-value-journey' } }))}
                className="w-full relative overflow-hidden group text-left rounded-2xl bg-[#121214] border border-white/[0.08] hover:border-indigo-500/50 transition-all duration-300 p-6 md:p-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] to-transparent pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-3 flex-1">
                    <span className="inline-block px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded">
                      {t('firstValueJourney.recommended')}
                    </span>
                    <h3 className="text-lg md:text-xl font-bold text-white">
                      {t('firstValueJourney.suggestedSongsTitle')}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                      {t('firstValueJourney.suggestedSongsDescription')}
                    </p>
                  </div>
                  
                  <div className="shrink-0 flex items-center gap-2 text-indigo-400 group-hover:text-indigo-300 font-semibold text-sm transition-colors">
                    {t('firstValueJourney.suggestedSongsAction')}
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>

              {/* Other Ways */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 pl-1">
                  {t('firstValueJourney.otherWaysTitle')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleAction('manual', openSongForm)}
                    className="flex flex-col items-start gap-1 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all text-left min-h-[48px]"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <Plus className="w-4 h-4 text-zinc-400" />
                      {t('firstValueJourney.manualTitle')}
                    </div>
                    <span className="text-xs text-zinc-500 line-clamp-2 pl-6">{t('firstValueJourney.manualDescription')}</span>
                  </button>
                  
                  <LockedActionButton 
                    featureKey="libraryAccess"
                    requiredPlan="advanced"
                    label={t('firstValueJourney.libraryTitle')}
                    icon={<Library className="w-4 h-4 text-indigo-400" />}
                    onClick={() => handleAction('library', () => navigate('/library'))}
                    className="flex flex-col items-start gap-1 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all text-left min-h-[48px] h-auto"
                    rightIcon={null}
                    // Instead of using rightIcon for the plan badge inside the button text, 
                    // we can let the canonical button handle it, but the canonical button is designed for row layout.
                    // Let's use standard LockedActionButton from canonical
                  />
                  
                  <LockedActionButton 
                    featureKey="aiImport"
                    requiredPlan="pro"
                    label={t('firstValueJourney.aiTitle')}
                    icon={<Wand2 className="w-4 h-4 text-amber-400" />}
                    onClick={() => handleAction('aiImport', openAiSongImport)}
                    className="flex flex-col items-start gap-1 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all text-left min-h-[48px] h-auto"
                    rightIcon={null}
                  />
                </div>
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
            <div className="space-y-3">
              <button
                onClick={() => handleAction('createScale', openScaleForm)}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {t('firstValueJourney.createScaleAction')}
              </button>
              <p className="text-xs text-zinc-500">
                {t('firstValueJourney.draftNote')}
              </p>
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
            
            <div className="pt-2">
              <button
                onClick={() => handleAction('continueDraft', () => {
                  if (draftScale?.id) navigate(`/scales/${draftScale.id}`);
                  else navigate('/scales');
                })}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-zinc-900 font-bold hover:bg-zinc-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {t('firstValueJourney.continueDraftAction')}
              </button>
            </div>

            {/* Team Secondary Block */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-200">{t('firstValueJourney.teamTitle')}</h3>
                    {!hasTeam ? (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 bg-white/[0.05] px-2 py-0.5 rounded-full">
                        {t('firstValueJourney.teamOptional')}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('firstValueJourney.teamCompleted')}
                      </span>
                    )}
                  </div>
                  {!hasTeam && (
                    <p className="text-xs text-zinc-500">{t('firstValueJourney.teamOptionalDescription')}</p>
                  )}
                </div>
                
                {!hasTeam && canManageMembers && (
                  <button
                    onClick={() => handleAction('addTeam', () => navigate('/users'))}
                    className="shrink-0 px-4 py-2 text-sm font-semibold text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors border border-white/[0.05]"
                  >
                    {t('firstValueJourney.addTeamAction')}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getMilestoneIcon = (id: string) => {
    switch (id) {
      case 'repertoire': return <Music className="w-4 h-4" />;
      case 'firstScale': return <Calendar className="w-4 h-4" />;
      case 'publish': return <CheckCircle2 className="w-4 h-4" />;
      default: return null;
    }
  };

  const getMilestoneLabel = (id: string, isMobile: boolean) => {
    switch (id) {
      case 'repertoire': return isMobile ? t('firstValueJourney.milestoneRepertoireShort') : t('firstValueJourney.milestoneRepertoire');
      case 'firstScale': return isMobile ? t('firstValueJourney.milestoneFirstScaleShort') : t('firstValueJourney.milestoneFirstScale');
      case 'publish': return isMobile ? t('firstValueJourney.milestonePublishShort') : t('firstValueJourney.milestonePublish');
      default: return '';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-8 p-0 rounded-[24px] bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/[0.06] shadow-2xl overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.02]" />
        <div 
          className="absolute top-0 left-0 h-1 bg-indigo-500 transition-all duration-700 ease-out rounded-r-full"
          style={{ width: `${(completedEssentialSteps / totalEssentialSteps) * 100}%` }}
        />
        
        {/* Header and Stepper Section */}
        <div className="p-5 md:p-8 border-b border-white/[0.04] space-y-6 md:space-y-8">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-400 mb-2">
              {t('firstValueJourney.eyebrow')}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
              {t('firstValueJourney.title')}
            </h1>
            <p className="text-sm md:text-base text-zinc-400 max-w-2xl">
              {t('firstValueJourney.subtitle')}
            </p>
          </div>

          {/* 3-Column Stepper */}
          <div className="grid grid-cols-3 gap-2 md:gap-4 md:flex md:flex-row md:max-w-xl">
            {milestones.map((m, idx) => {
              const isCompleted = m.status === 'completed';
              const isCurrent = m.status === 'current';
              
              return (
                <div key={m.id} className={`flex flex-col md:flex-row items-center md:justify-start gap-2 md:gap-3 p-2 md:p-0 md:flex-1 text-center md:text-left transition-opacity ${isCompleted ? 'opacity-50' : (isCurrent ? 'opacity-100' : 'opacity-40')}`}>
                  <div className={`w-8 h-8 md:w-10 md:h-10 mx-auto md:mx-0 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted ? 'bg-indigo-500/20 text-indigo-400' : 
                    (isCurrent ? 'bg-white text-zinc-900 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-white/[0.05] text-zinc-400')
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 md:w-5 h-4 md:h-5" /> : getMilestoneIcon(m.id)}
                  </div>
                  <div className="flex flex-col hidden md:flex">
                    <span className={`text-[13px] font-bold ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                      {getMilestoneLabel(m.id, false)}
                    </span>
                  </div>
                  <div className="flex flex-col md:hidden w-full">
                    <span className={`text-[11px] font-bold leading-tight ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                      {getMilestoneLabel(m.id, true)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Content Section */}
        <div className="p-5 md:p-8 bg-[#0a0a0c]">
          {renderContent()}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
