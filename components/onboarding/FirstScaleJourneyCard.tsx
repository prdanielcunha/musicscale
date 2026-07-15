import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Music, Calendar, Users, Send } from 'lucide-react';
import { useFirstScaleExperience, OnboardingState } from '../../hooks/useFirstScaleExperience';
import { useTranslation } from 'react-i18next';
import { useEcosystem } from '../../contexts/EcosystemContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicDataContext';
import { useModals } from '../../contexts/ModalContext';

export function FirstScaleJourneyCard() {
  const { state, isLoading, isCompleted, dismissTeamStep } = useFirstScaleExperience();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { publishEvent: trackEvent } = useEcosystem();
  const { organization } = useAuth();
  const { scales } = useMusic();
  const { openScaleForm } = useModals();

  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isCompleted && state !== 'loading' && organization) {
      const key = `${organization.id}_${state}`;
      if (viewedRef.current !== key) {
        trackEvent({ type: 'telemetry', payload: { action: 'musicscale_onboarding_card_viewed', step: state, organizationId: organization.id }, timestamp: Date.now() });
        viewedRef.current = key;
      }
    }
  }, [state, isLoading, isCompleted, organization, trackEvent]);

  if (isLoading || isCompleted) {
    return null;
  }

  const handleAction = () => {
    trackEvent({ type: 'telemetry', payload: { action: 'musicscale_onboarding_started', step: state, organizationId: organization?.id }, timestamp: Date.now() });
    
    if (state === 'needsStarterRepertoire') {
      navigate('/songs?starterPack=1');
    } else if (state === 'needsFirstScale') {
      openScaleForm();
    } else if (state === 'needsTeam') {
      navigate('/users');
    } else if (state === 'needsPublish') {
      const draft = scales?.find(s => s.status !== 'published');
      if (draft) {
         navigate(`/scales/${draft.id}`);
      } else {
         navigate('/scales');
      }
    }
  };

  const getContent = () => {
    switch (state) {
      case 'needsStarterRepertoire':
        return {
          title: t('onboarding.repertoireTitle', 'Prepare sua primeira escala'),
          description: t('onboarding.repertoireDesc', 'Comece com um repertório pronto e organize o próximo culto em poucos minutos.'),
          cta: t('onboarding.repertoireCta', 'Começar preparação'),
          icon: <Music className="w-5 h-5 text-indigo-400" />
        };
      case 'needsFirstScale':
        return {
          title: t('onboarding.scaleTitle', 'Monte o próximo culto'),
          description: t('onboarding.scaleDesc', 'Seu repertório está pronto. Agora escolha a data, as músicas e revise a escala.'),
          cta: t('onboarding.scaleCta', 'Criar primeira escala'),
          icon: <Calendar className="w-5 h-5 text-indigo-400" />
        };
      case 'needsTeam':
        return {
          title: t('onboarding.teamTitle', 'Adicione sua equipe'),
          description: t('onboarding.teamDesc', 'Convide seus músicos e líderes para que eles recebam as escalas e notificações.'),
          cta: t('onboarding.teamCta', 'Adicionar equipe'),
          secondaryAction: t('onboarding.teamDismiss', 'Fazer depois'),
          icon: <Users className="w-5 h-5 text-indigo-400" />
        };
      case 'needsPublish':
        return {
          title: t('onboarding.publishTitle', 'Sua primeira escala está quase pronta'),
          description: t('onboarding.publishDesc', 'Revise as informações e publique para avisar a equipe.'),
          cta: t('onboarding.publishCta', 'Revisar e publicar'),
          icon: <Send className="w-5 h-5 text-indigo-400" />
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-8 p-6 rounded-2xl bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 shadow-2xl overflow-hidden relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2 text-xs font-medium tracking-widest uppercase text-zinc-500">
               {content.icon}
               <span className="opacity-80">{t('onboarding.breadcrumbs', 'Repertório · Evento · Equipe')}</span>
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
                {content.title}
              </h2>
              <p className="text-sm md:text-base text-zinc-400 max-w-xl leading-relaxed">
                {content.description}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            {content.secondaryAction && (
              <button 
                onClick={() => {
                   trackEvent({ type: 'telemetry', payload: { action: 'musicscale_onboarding_dismissed', step: state, organizationId: organization?.id }, timestamp: Date.now() });
                   dismissTeamStep();
                }}
                className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-zinc-400 hover:text-white transition-colors"
              >
                {content.secondaryAction}
              </button>
            )}
            <button
              onClick={handleAction}
              className="w-full sm:w-auto group shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-900 font-bold hover:bg-zinc-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 active:scale-95"
            >
              {content.cta}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
