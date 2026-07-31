import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Plus, Calendar, Users, Music, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCapability } from '../../hooks/useCapability';
import { useModals } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { resolveAvailableCreateActions, CreateActionType } from '../../utils/globalCreateActions';
import { createPortal } from 'react-dom';

interface GlobalCreateActionProps {
  variant: 'desktop' | 'mobile';
}

export const GlobalCreateAction: React.FC<GlobalCreateActionProps> = ({ variant }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasCapability } = useCapability();
  const { organization } = useAuth();
  const { openScaleForm, openBandScaleForm, openSongForm } = useModals();

  const [isOpen, setIsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const actions = resolveAvailableCreateActions(hasCapability);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, organization?.id]);

  useEffect(() => {
    if (variant === 'mobile') return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, variant]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (variant === 'mobile' && isOpen) {
      document.body.style.overflow = 'hidden';
    } else if (variant === 'mobile') {
      document.body.style.overflow = '';
    }
    return () => {
      if (variant === 'mobile') document.body.style.overflow = '';
    };
  }, [isOpen, variant]);

  if (actions.length === 0) {
    return null;
  }

  const handleActionClick = async (actionId: CreateActionType) => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setIsOpen(false);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
      if (actionId === 'music-scale') {
        openScaleForm();
      } else if (actionId === 'band-scale') {
        openBandScaleForm();
      } else if (actionId === 'song') {
        openSongForm();
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  const getIcon = (type: CreateActionType) => {
    switch (type) {
      case 'music-scale':
        return <Calendar className="w-5 h-5" />;
      case 'band-scale':
        return <Users className="w-5 h-5" />;
      case 'song':
        return <Music className="w-5 h-5" />;
      default:
        return <Plus className="w-5 h-5" />;
    }
  };

  const renderActionList = () => (
    <ul className="flex flex-col w-full outline-none" role="menu">
      {actions.map((action, index) => (
        <li key={action.id} role="none">
          <button
            role="menuitem"
            className="w-full text-left flex items-start gap-4 px-4 py-3 sm:py-3.5 hover:bg-slate-100 dark:hover:bg-white/5 active:bg-slate-200 dark:active:bg-white/10 transition-colors focus:outline-none focus:bg-slate-100 dark:focus:bg-white/5 rounded-xl group"
            onClick={() => handleActionClick(action.id)}
            autoFocus={index === 0}
          >
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/70 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
              {getIcon(action.iconType)}
            </div>
            <div className="flex flex-col min-w-0 pt-0.5">
              <span className="text-[14px] sm:text-[15px] font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors leading-tight">
                {t(action.labelKey, action.defaultLabel)}
              </span>
              <span className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-white/50 mt-1 line-clamp-2 leading-snug">
                {t(action.descriptionKey, action.defaultDescription)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );

  if (variant === 'desktop') {
    return (
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={t('globalCreate.trigger', 'Criar')}
          className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all border shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isOpen 
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
              : 'bg-[#18181b]/60 border-white/[0.06] text-slate-200 hover:bg-[#18181b] hover:text-white premium-interactive'
          }`}
        >
          <Plus className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-[calc(100%+12px)] w-[320px] bg-white dark:bg-[#111115] border border-slate-200 dark:border-white/[0.08] shadow-[0_24px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-2xl z-[100] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02]">
                <h3 className="text-[13px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-widest">
                  {t('globalCreate.title', 'O que você quer criar?')}
                </h3>
              </div>
              <div className="p-2">
                {renderActionList()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      <div className="absolute left-1/2 -translate-x-1/2 -top-[24px] pointer-events-auto">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={t('globalCreate.trigger', 'Criar')}
          className="flex items-center justify-center w-[52px] h-[52px] rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-[0_8px_20px_rgba(99,102,241,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300 border border-indigo-400/30"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[200] flex flex-col justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />
              
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full bg-white dark:bg-[#111115] rounded-t-[32px] border-t border-slate-200 dark:border-white/[0.08] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="global-create-title"
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                  <h2 id="global-create-title" className="text-[20px] font-bold text-slate-900 dark:text-white tracking-tight">
                    {t('globalCreate.title', 'O que você quer criar?')}
                  </h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    aria-label={t('globalCreate.close', 'Fechar')}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60 active:bg-slate-200 dark:active:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="px-4 pb-8 overflow-y-auto max-h-[60vh]">
                  {renderActionList()}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
