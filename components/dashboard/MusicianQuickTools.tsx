import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AudioLines, BookOpenText, Gauge, MonitorPlay, TimerReset } from 'lucide-react';

type QuickTool = {
  id: 'tuner' | 'metronome' | 'pads' | 'chords' | 'performance';
  to?: string;
  onClick?: () => void;
  icon: React.ElementType;
};

interface MusicianQuickToolsProps {
  /** Reuse the current performance navigation, with its event/permission gates. */
  canUsePerformance: boolean;
  onOpenPerformance: () => void;
}

/**
 * Compact discovery rail for real MusicScale tools. Never triggers audio or
 * microphone access before the musician opens the actual tool.
 */
export function MusicianQuickTools({ canUsePerformance, onOpenPerformance }: MusicianQuickToolsProps) {
  const { t } = useTranslation();
  const tools: QuickTool[] = [
    { id: 'tuner', to: '/stage-tools/tuner', icon: Gauge },
    { id: 'metronome', to: '/stage-tools?tool=metronome', icon: TimerReset },
    { id: 'pads', to: '/stage-tools?tool=pads', icon: AudioLines },
    { id: 'chords', to: '/songs', icon: BookOpenText },
    ...(canUsePerformance ? [
      { id: 'performance' as const, onClick: onOpenPerformance, icon: MonitorPlay },
    ] : []),
  ];

  return (
    <section data-testid="ms-musician-quick-tools" className="ms-premium-quick-tools min-w-0" aria-labelledby="ms-quick-tools-heading">
      <div className="mb-3 flex min-w-0 items-end justify-between gap-3 px-0.5">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.19em] text-[#3ed5dd]/85">
            {t('dashboard.quickTools.eyebrow')}
          </p>
          <h2 id="ms-quick-tools-heading" className="text-[16px] font-semibold tracking-[-0.025em] text-white sm:text-[18px]">
            {t('dashboard.quickTools.title')}
          </h2>
        </div>
        <Link to="/stage-tools" className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-2 text-[11px] font-semibold text-[#9db9e8] transition-colors hover:text-[#3ed5dd]">
          {t('dashboard.quickTools.all')}
        </Link>
      </div>
      <div
        data-testid="ms-quick-tools-rail"
        className="ms-premium-quick-tools__rail -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible sm:px-0"
      >
        {tools.map(tool => {
          const Icon = tool.icon;
          const className = "group flex min-h-[91px] w-[105px] shrink-0 snap-start flex-col items-start justify-between rounded-2xl border border-white/[0.075] bg-[#111821]/85 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-[background-color,border-color,transform] duration-150 hover:border-[#3ed5dd]/35 hover:bg-[#142332] active:scale-[0.98] sm:w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ed5dd]";
          const contents = (
            <>
              <Icon className="h-[20px] w-[20px] text-[#55ccd9] transition-colors group-hover:text-[#84e8eb]" strokeWidth={1.8} aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-4 text-white/90">{t(`dashboard.quickTools.${tool.id}`)}</span>
            </>
          );
          return tool.to ? (
            <Link key={tool.id} to={tool.to} className={className} aria-label={t(`dashboard.quickTools.open`, { tool: t(`dashboard.quickTools.${tool.id}`) })}>
              {contents}
            </Link>
          ) : (
            <button key={tool.id} type="button" onClick={tool.onClick} className={className} aria-label={t('dashboard.quickTools.open', { tool: t(`dashboard.quickTools.${tool.id}`) })}>
              {contents}
            </button>
          );
        })}
      </div>
    </section>
  );
}
