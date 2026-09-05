import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Calendar, Users, Music, X, Sparkles, BookOpen, FileText } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useCapability } from '../../hooks/useCapability';
import { useModals } from '../../contexts/ModalContext';
import { useAuth, useFeatures, useLimits } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicDataContext';
import { useToast } from '../../contexts/ToastContext';
import { useMusicScaleFeature } from '../../hooks/useMusicScaleEntitlements';
import { resolveGlobalCreateActions, GlobalCreateActionId, ResolvedGlobalCreateAction } from '../../utils/globalCreateActions';
import { createPortal } from 'react-dom';
import { UpgradePlanModal } from '../premium/EntitlementGates';
import { MusicScaleFeatures } from '../../services/entitlementsService';

interface GlobalCreateActionProps {
  variant: 'desktop' | 'mobile';
}

export const GlobalCreateAction: React.FC<GlobalCreateActionProps> = ({ variant }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasCapability } = useCapability();
  const { organization } = useAuth();
  const { canAccessGlobalLibrary } = useFeatures();
  const { limits } = useLimits();
  const { songs } = useMusic();
  const { toast } = useToast();
  const { openScaleForm, openBandScaleForm, openSongForm, openAiSongImport } = useModals();
  const isAiImportAllowed = useMusicScaleFeature('aiImport');
  
  const [isOpen, setIsOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<keyof MusicScaleFeatures | null>(null);
  const pendingActionRef = useRef<GlobalCreateActionId | null>(null);
  const pendingUpgradeFeatureRef = useRef<keyof MusicScaleFeatures | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const canManageSongs = hasCapability('musicscale.songs.edit');
  const canManageScales = hasCapability('musicscale.scales.manage');
  const canUseGlobalLibrary = Boolean(canAccessGlobalLibrary());
  const aiImportAvailability = isAiImportAllowed ? 'enabled' : 'plan-locked';
  const libraryAvailability = canUseGlobalLibrary ? 'enabled' : 'plan-locked';
  
  const resolvedActions = React.useMemo(() => {
    const songCount = songs?.length ?? 0;
    const maxSongs = limits.maxSongs;
    const limitReached = typeof maxSongs === 'number' && Number.isFinite(maxSongs) && maxSongs >= 0 && songCount >= maxSongs;

    const allActions = resolveGlobalCreateActions({
      hasCapability: (capability) => {
        if (capability === 'musicscale.songs.edit') return canManageSongs;
        if (capability === 'musicscale.scales.manage') return canManageScales;
        return false;
      },
      aiImportAvailability,
      libraryAvailability,
      songLimitReached: limitReached
    });
    
    // Include plan-locked actions directly in the UI instead of filtering them out
    return allActions.filter(a => a.availability === 'enabled' || a.availability === 'limit-reached' || a.availability === 'plan-locked');
  }, [canManageSongs, canManageScales, aiImportAvailability, libraryAvailability, songs?.length, limits.maxSongs]);

  const availableActionSignature = resolvedActions
    .map(action => `${action.id}:${action.availability}`)
    .join('|');

  // Cancel pending action if context changes
  useEffect(() => {
    pendingActionRef.current = null;
    setIsOpen(false);
  }, [organization?.id, location.pathname, availableActionSignature]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (variant === 'desktop' && isOpen && popoverRef.current && !popoverRef.current.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, variant]);

  // Handle focus trap and body overflow for mobile dialog
  const previousOverflow = useRef<string | null>(null);
  useEffect(() => {
    if (isOpen && variant === 'mobile') {
      previousOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const dialog = document.getElementById('global-create-dialog');
      if (dialog) {
        const focusableElements = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length > 0) {
          (focusableElements[0] as HTMLElement).focus();
        }
      }
    }
    return () => {
      if (variant === 'mobile' && previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
      }
    };
  }, [isOpen, variant]);

  const handleActionClick = (action: ResolvedGlobalCreateAction) => {
    if (pendingActionRef.current || pendingUpgradeFeatureRef.current) return;

    if (action.availability === 'plan-locked') {
      const fKey = action.id === 'ai-song-import' ? 'aiImport' : 'libraryAccess';
      pendingUpgradeFeatureRef.current = fKey;
      setIsOpen(false);
      return;
    }

    if (action.availability === 'limit-reached') {
      toast({
        type: 'warning',
        message: t('globalCreate.states.limitReachedTitle', 'Limite de Uso Atingido'),
        description: t('globalCreate.states.limitReachedDesc', 'Você atingiu o limite permitido pelo seu plano para esta ação. Faça upgrade para continuar.')
      });
      setIsOpen(false);
      return;
    }
    
    pendingActionRef.current = action.id;
    setIsOpen(false);
  };

  const handleExitComplete = () => {
    const actionId = pendingActionRef.current;
    const upgradeKey = pendingUpgradeFeatureRef.current;

    if (upgradeKey) {
      setUpgradeFeature(upgradeKey);
      pendingUpgradeFeatureRef.current = null;
    } else if (actionId) {
      if (actionId === 'music-scale') {
        openScaleForm();
      } else if (actionId === 'band-scale') {
        openBandScaleForm();
      } else if (actionId === 'song-manual') {
        openSongForm();
      } else if (actionId === 'ai-song-import') {
        openAiSongImport();
      } else if (actionId === 'library-song-import') {
        navigate('/library?intent=import', { replace: true });
      }
      pendingActionRef.current = null;
    } else {
      triggerRef.current?.focus();
    }
  };

  if (resolvedActions.length === 0) {
    return null;
  }

  const getIcon = (type: GlobalCreateActionId) => {
    switch (type) {
      case 'ai-song-import':
        return <Sparkles className="w-5 h-5 text-indigo-400 dark:text-indigo-300" />;
      case 'library-song-import':
        return <BookOpen className="w-5 h-5" />;
      case 'song-manual':
        return <FileText className="w-5 h-5" />;
      case 'music-scale':
        return <Calendar className="w-5 h-5" />;
      case 'band-scale':
        return <Users className="w-5 h-5" />;
      default:
        return <Plus className="w-5 h-5" />;
    }
  };

  const renderGroup = (group: 'songs' | 'scales', titleKey: string, defaultTitle: string) => {
    const groupActions = resolvedActions.filter(a => a.group === group);
    if (groupActions.length === 0) return null;

    return (
      <div role="group" aria-labelledby={`group-${group}`}>
        <div id={`group-${group}`} className="px-4 py-2 mt-2">
          <span className="text-[11px] sm:text-[12px] font-semibold text-slate-500 dark:text-white/50 tracking-wider">
            {t(titleKey, defaultTitle)}
          </span>
        </div>
        <ul className="flex flex-col w-full outline-none" role={variant === 'desktop' ? 'none' : undefined}>
          {groupActions.map((action, index) => {
            const isLocked = action.availability === 'plan-locked';
            const isLimit = action.availability === 'limit-reached';
            
            return (
              <li key={action.id} role={variant === 'desktop' ? 'none' : undefined}>
                <button
                  role={variant === 'desktop' ? 'menuitem' : undefined}
                  className="w-full text-left flex items-start gap-4 px-4 py-3 sm:py-3.5 hover:bg-slate-100 dark:hover:bg-white/5 active:bg-slate-200 dark:active:bg-white/10 transition-colors focus:outline-none focus:bg-slate-100 dark:focus:bg-white/5 rounded-xl group"
                  onClick={() => handleActionClick(action)}
                >
                  <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 transition-colors ${
                    action.id === 'ai-song-import' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-white/70 group-hover:text-indigo-600 dark:group-hover:text-white'
                  }`}>
                    {getIcon(action.iconType)}
                  </div>
                  <div className="flex flex-col min-w-0 pt-0.5 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[14px] sm:text-[15px] font-bold transition-colors leading-tight ${
                        isLocked ? 'text-slate-700 dark:text-white/80 group-hover:text-indigo-700 dark:group-hover:text-indigo-300' : 'text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300'
                      }`}>
                        {t(action.labelKey, action.defaultLabel)}
                      </span>
                      {action.badgeKey && !isLocked && !isLimit && (
                        <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/20 rounded-full">
                          {t(action.badgeKey, action.defaultBadge)}
                        </span>
                      )}
                      {isLocked && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> PRO
                        </span>
                      )}
                      {isLimit && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {t('globalCreate.states.limitReached', 'Limite atingido')}
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-white/50 mt-1 line-clamp-2 leading-snug">
                      {t(action.descriptionKey, action.defaultDescription)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderActionList = () => {
    const hasSongs = resolvedActions.some(a => a.group === 'songs');
    const hasScales = resolvedActions.some(a => a.group === 'scales');
    
    return (
      <div id={variant === 'desktop' ? 'global-create-menu' : undefined} role={variant === 'desktop' ? 'menu' : undefined}>
        {renderGroup('scales', 'globalCreate.groups.scales', 'Escalas')}
        {hasSongs && hasScales && (
          <div className="mx-4 my-1 border-t border-slate-200 dark:border-white/5" role={variant === 'desktop' ? 'separator' : undefined}></div>
        )}
        {renderGroup('songs', 'globalCreate.groups.songs', 'Músicas')}
      </div>
    );
  };

  if (variant === 'desktop') {
    return (
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-controls="global-create-menu"
          aria-label={t('globalCreate.trigger', 'Criar')}
          className={`flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-full transition-all border shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isOpen 
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
              : 'bg-[#18181b]/60 border-white/[0.06] text-slate-200 hover:bg-[#18181b] hover:text-white premium-interactive'
          }`}
        >
          <Plus className={`w-4 h-4 mr-1.5 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
          <span className="text-[13px] sm:text-sm font-bold tracking-wide">{t('globalCreate.trigger', 'Criar')}</span>
        </button>

        <AnimatePresence onExitComplete={handleExitComplete}>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-[calc(100%+12px)] w-[360px] bg-white dark:bg-[#111115] border border-slate-200 dark:border-white/[0.09] shadow-[0_24px_64px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.07)] rounded-2xl z-[100] overflow-hidden backdrop-blur-[28px] saturate-[150%]"
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('globalCreate.title', 'Criar ou importar')}
                </h3>
              </div>
              <div className="p-1 pb-2">
                {renderActionList()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <UpgradePlanModal
          isOpen={upgradeFeature !== null}
          onClose={() => {
            setUpgradeFeature(null);
            triggerRef.current?.focus();
          }}
          featureKey={upgradeFeature || undefined}
        />
      </div>
    );
  }

  // Mobile Variant
  return (
    <>
      <div className="pointer-events-auto z-[110] relative rounded-full">
        <button
          ref={triggerRef}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-controls="global-create-dialog"
          aria-label={t('globalCreate.trigger', 'Criar')}
          className="flex items-center h-11 w-auto px-4 rounded-full bg-[linear-gradient(180deg,rgba(49,46,129,0.98)_0%,rgba(30,27,75,0.98)_100%)] text-white/90 shadow-[0_6px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.98] active:bg-[linear-gradient(180deg,rgba(55,48,163,0.98)_0%,rgba(49,46,129,0.98)_100%)] transition-transform duration-150 ease-out border border-[#a5b4fc]/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 touch-manipulation transform-gpu"
        >
          <Plus className="w-4 h-4 mr-1.5 text-[#a5b4fc]" />
          <span className="text-[13px] font-semibold">{t('globalCreate.trigger', 'Criar')}</span>
        </button>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence onExitComplete={handleExitComplete}>
          {isOpen && (
            <div className="fixed inset-0 z-[200] flex flex-col justify-end items-end p-3 sm:p-4 pb-[calc(70px+env(safe-area-inset-bottom))]">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12, ease: "easeOut" }}
                className="absolute inset-0 bg-black/55"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />
              
              <motion.div
                id="global-create-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="global-create-title"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'bottom right', willChange: 'transform, opacity' }}
                className="relative w-full max-w-[400px] bg-white dark:bg-[#111115] rounded-[28px] border border-slate-200 dark:border-white/[0.09] shadow-[0_24px_64px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.07)] flex flex-col overflow-hidden max-h-[min(70dvh,540px)] transform-gpu"
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/[0.05]">
                  <div>
                    <h2 id="global-create-title" className="text-[20px] font-bold text-slate-900 dark:text-white tracking-tight">
                      {t('globalCreate.title', 'Criar ou importar')}
                    </h2>
                    <p className="text-[13px] text-slate-500 dark:text-white/60 mt-1">
                      {t('globalCreate.subtitle', 'Escolha o caminho mais rápido.')}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    aria-label={t('globalCreate.close', 'Fechar')}
                    className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60 active:bg-slate-200 dark:active:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-1 pb-4 overflow-y-auto">
                  {renderActionList()}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <UpgradePlanModal
        isOpen={upgradeFeature !== null}
        onClose={() => {
          setUpgradeFeature(null);
          triggerRef.current?.focus();
        }}
        featureKey={upgradeFeature || undefined}
      />
    </>
  );
};
