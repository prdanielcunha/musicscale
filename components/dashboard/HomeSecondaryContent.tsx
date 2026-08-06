import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Compass, Library, Sparkles, MonitorPlay } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface HomeSecondaryContentProps {
  children?: React.ReactNode;
  onOpenLibrary: () => void;
  onOpenAiImport: () => void;
  onOpenPerformance: () => void;
  canImportSongs: boolean;
  canOpenPerformance: boolean;
}

export const HomeSecondaryContent: React.FC<HomeSecondaryContentProps> = ({
  children,
  onOpenLibrary,
  onOpenAiImport,
  onOpenPerformance,
  canImportSongs,
  canOpenPerformance
}) => {
  const { t } = useTranslation();
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);

  const contextualItems = React.Children.toArray(children);
  const hasContextualContent = contextualItems.length > 0;

  return (
    <section aria-labelledby="dashboard-explore-title" className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs">
          <Compass className="w-4 h-4" aria-hidden="true" />
          <span>{t('dashboard.explore.eyebrow')}</span>
        </div>
        <h2 id="dashboard-explore-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('dashboard.explore.title')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-2xl">
          {t('dashboard.explore.description')}
        </p>
      </header>

      {/* Premium Discovery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Library Card */}
        <button
          type="button"
          onClick={onOpenLibrary}
          aria-label={t('dashboard.explore.libraryCta')}
          className="group relative flex flex-col items-start text-left bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 lg:p-8 overflow-hidden transition-all duration-300 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 lg:col-span-2 min-h-[44px] motion-safe:hover:-translate-y-0.5"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 transition-transform duration-500 group-hover:scale-110 pointer-events-none" aria-hidden="true">
            <Library className="w-32 h-32" />
          </div>
          
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-4">
            {t('dashboard.explore.libraryBadge')}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 relative z-10">
            {t('dashboard.explore.libraryTitle')}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 relative z-10 max-w-sm">
            {t('dashboard.explore.libraryDescription')}
          </p>
          
          <div className="flex flex-wrap gap-2 mb-6 relative z-10">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200/50 dark:border-slate-700/50 whitespace-nowrap">
              {t('dashboard.explore.libraryBenefitChords')}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200/50 dark:border-slate-700/50 whitespace-nowrap">
              {t('dashboard.explore.libraryBenefitKeys')}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200/50 dark:border-slate-700/50 whitespace-nowrap">
              {t('dashboard.explore.libraryBenefitReady')}
            </span>
          </div>

          <div className="mt-auto relative z-10 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
            {t('dashboard.explore.libraryCta')} &rarr;
          </div>
        </button>

        {/* AI Import Card */}
        {canImportSongs && (
          <button
            type="button"
            onClick={onOpenAiImport}
            aria-label={t('dashboard.explore.aiCta')}
            className="group relative flex flex-col items-start text-left bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 overflow-hidden transition-all duration-300 hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 lg:col-span-1 min-h-[44px] motion-safe:hover:-translate-y-0.5"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 transition-transform duration-500 group-hover:scale-110 pointer-events-none" aria-hidden="true">
              <Sparkles className="w-24 h-24" />
            </div>
            
            <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest mb-4">
              {t('dashboard.explore.aiBadge')}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 relative z-10">
              {t('dashboard.explore.aiTitle')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 relative z-10">
              {t('dashboard.explore.aiDescription')}
            </p>
            
            <div className="mt-auto relative z-10 text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
              {t('dashboard.explore.aiCta')} &rarr;
            </div>
          </button>
        )}

        {/* Performance Mode Card */}
        <button
          type="button"
          onClick={onOpenPerformance}
          aria-label={canOpenPerformance ? t('dashboard.explore.performanceOpenCta') : t('dashboard.explore.performanceScalesCta')}
          className={`group relative flex flex-col items-start text-left bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 overflow-hidden transition-all duration-300 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 min-h-[44px] motion-safe:hover:-translate-y-0.5 ${canImportSongs ? 'lg:col-span-1' : 'lg:col-span-2'}`}
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 transition-transform duration-500 group-hover:scale-110 pointer-events-none" aria-hidden="true">
            <MonitorPlay className="w-24 h-24" />
          </div>
          
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-widest mb-4">
            {t('dashboard.explore.performanceBadge')}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 relative z-10">
            {t('dashboard.explore.performanceTitle')}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 relative z-10">
            {t('dashboard.explore.performanceDescription')}
          </p>
          
          <div className="mt-auto relative z-10 text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
            {canOpenPerformance ? t('dashboard.explore.performanceOpenCta') : t('dashboard.explore.performanceScalesCta')} &rarr;
          </div>
        </button>
      </div>

      {/* Contextual Content */}
      {hasContextualContent && (
        <div className="rounded-[24px] border border-slate-200/70 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.025] backdrop-blur-sm p-4 sm:p-6 lg:p-8 mt-4">
          {/* Desktop view for contextual */}
          <div className="hidden lg:block space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('dashboard.explore.activityTitle')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('dashboard.explore.activityDescription')}
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {children}
            </div>
          </div>

          {/* Mobile disclosure view for contextual */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setIsActivityExpanded(!isActivityExpanded)}
              aria-expanded={isActivityExpanded}
              aria-controls="dashboard-contextual-content"
              aria-label={isActivityExpanded ? t('dashboard.explore.activityCollapse') : t('dashboard.explore.activityExpand')}
              className="w-full max-w-full min-w-0 h-auto overflow-hidden text-left cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black rounded-2xl"
            >
              <div className="flex flex-col w-full">
                <div className="space-y-1 w-full min-w-0 max-w-full">
                  <div className="text-slate-900 dark:text-white font-bold text-base">
                    {t('dashboard.explore.activityTitle')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-normal break-words max-w-full leading-relaxed">
                    {t('dashboard.explore.activityDescription')}
                  </div>
                </div>
                <div className="mt-4 flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200/80 dark:border-white/[0.07] bg-slate-100/80 dark:bg-white/[0.04] px-3 py-2.5 transition-colors hover:bg-slate-200/70 dark:hover:bg-white/[0.07] text-indigo-600 dark:text-indigo-300">
                  <span className="text-sm font-semibold min-w-0">
                    {isActivityExpanded ? t('dashboard.explore.activityCollapse') : t('dashboard.explore.activityExpand')}
                  </span>
                  {isActivityExpanded ? (
                    <ChevronUp className="w-5 h-5 shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="w-5 h-5 shrink-0 ml-2" />
                  )}
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isActivityExpanded && (
                <motion.div
                  id="dashboard-contextual-content"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 pb-2 grid grid-cols-1 gap-4">
                    {children}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  );
};

