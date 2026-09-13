import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Compass, Library, Sparkles, MonitorPlay, ArrowUpRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

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
  const shouldReduceMotion = useReducedMotion();
  const contextualItems = React.Children.toArray(children);
  const hasContextualContent = contextualItems.length > 0;

  const cards = [
    {
      id: 'library',
      visible: true,
      wide: true,
      onClick: onOpenLibrary,
      icon: Library,
      badge: t('dashboard.explore.libraryBadge'),
      title: t('dashboard.explore.libraryTitle'),
      description: t('dashboard.explore.libraryDescription'),
      cta: t('dashboard.explore.libraryCta'),
      tone: 'primary',
    },
    {
      id: 'ai',
      visible: canImportSongs,
      wide: false,
      onClick: onOpenAiImport,
      icon: Sparkles,
      badge: t('dashboard.explore.aiBadge'),
      title: t('dashboard.explore.aiTitle'),
      description: t('dashboard.explore.aiDescription'),
      cta: t('dashboard.explore.aiCta'),
      tone: 'amber',
    },
    {
      id: 'performance',
      visible: true,
      wide: !canImportSongs,
      onClick: onOpenPerformance,
      icon: MonitorPlay,
      badge: t('dashboard.explore.performanceBadge'),
      title: t('dashboard.explore.performanceTitle'),
      description: t('dashboard.explore.performanceDescription'),
      cta: canOpenPerformance ? t('dashboard.explore.performanceOpenCta') : t('dashboard.explore.performanceScalesCta'),
      tone: 'emerald',
    },
  ].filter(card => card.visible);

  const toneClasses: Record<string, { badge: string; icon: string; line: string }> = {
    primary: {
      badge: 'border-primary/20 bg-primary/[0.08] text-primary-light',
      icon: 'text-primary-light',
      line: 'via-primary/60',
    },
    amber: {
      badge: 'border-amber-400/20 bg-amber-500/[0.07] text-amber-200',
      icon: 'text-amber-300',
      line: 'via-amber-400/60',
    },
    emerald: {
      badge: 'border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-200',
      icon: 'text-emerald-300',
      line: 'via-emerald-400/60',
    },
  };

  return (
    <section aria-labelledby="dashboard-explore-title" className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-primary-light/80">
            <Compass className="h-4 w-4" aria-hidden="true" />
            <span className="ms-kicker">{t('dashboard.explore.eyebrow')}</span>
          </div>
          <h2 id="dashboard-explore-title" className="text-[20px] font-semibold tracking-[-0.03em] text-white sm:text-[24px]">
            {t('dashboard.explore.title')}
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/42 sm:text-sm">
            {t('dashboard.explore.description')}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          const tone = toneClasses[card.tone];
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              aria-label={card.cta}
              className={`ms-card ms-card-interactive group relative flex min-h-[220px] flex-col items-start overflow-hidden p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-6 ${card.wide ? 'lg:col-span-2' : 'lg:col-span-1'}`}
            >
              <div className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${tone.line} to-transparent opacity-55`} />
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/[0.025] blur-3xl transition-opacity duration-300 group-hover:bg-white/[0.045]" />

              <div className="flex w-full items-start justify-between gap-4">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${tone.badge}`}>
                  {card.badge}
                </span>
                <span className={`flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.065] bg-white/[0.03] ${tone.icon}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              </div>

              <div className="mt-7 max-w-md">
                <h3 className="text-[17px] font-semibold tracking-[-0.025em] text-white sm:text-[19px]">{card.title}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-white/42 sm:text-[13px]">{card.description}</p>
              </div>

              {card.id === 'library' && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {[t('dashboard.explore.libraryBenefitChords'), t('dashboard.explore.libraryBenefitKeys'), t('dashboard.explore.libraryBenefitReady')].map(item => (
                    <span key={item} className="rounded-[9px] border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[10px] font-medium text-white/42">{item}</span>
                  ))}
                </div>
              )}

              <div className={`mt-auto flex items-center gap-1.5 pt-5 text-[11px] font-semibold ${tone.icon}`}>
                {card.cta}
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>

      {hasContextualContent && (
        <div className="ms-panel overflow-hidden">
          <div className="hidden p-5 sm:p-6 lg:block">
            <div className="mb-5">
              <span className="ms-kicker">{t('dashboard.explore.activityTitle')}</span>
              <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/38">{t('dashboard.explore.activityDescription')}</p>
            </div>
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">{children}</div>
          </div>

          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setIsActivityExpanded(value => !value)}
              aria-expanded={isActivityExpanded}
              aria-controls="dashboard-contextual-content"
              aria-label={isActivityExpanded ? t('dashboard.explore.activityCollapse') : t('dashboard.explore.activityExpand')}
              className="premium-interactive flex min-h-[72px] w-full items-center justify-between gap-4 px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white">{t('dashboard.explore.activityTitle')}</div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/38">{t('dashboard.explore.activityDescription')}</div>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-white/[0.07] bg-white/[0.03] text-white/45">
                {isActivityExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isActivityExpanded && (
                <motion.div
                  id="dashboard-contextual-content"
                  initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                  className="overflow-hidden border-t border-white/[0.055]"
                >
                  <div className="grid grid-cols-1 gap-3 p-4">{children}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  );
};
