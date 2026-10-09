import React from 'react';
import { AudioLines, ArrowUpRight, Layers3, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PINNED_PRODUCT_HIGHLIGHTS } from '../lib/releaseSpotlight';

const icons = {
  tuner: SlidersHorizontal,
  pad: AudioLines,
  medley: Layers3,
} as const;

interface PinnedReleaseHighlightsProps {
  titleId?: string;
  onAction?: () => void;
}

/** Always accessible from Novidades, including after dismissing the announcement. */
export function PinnedReleaseHighlights({
  titleId = 'release-title',
  onAction,
}: PinnedReleaseHighlightsProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby={titleId} className="pb-2">
      <span className="inline-flex items-center rounded-full border border-indigo-300/20 bg-indigo-400/[0.09] px-3 py-1.5 text-[11px] font-semibold tracking-[0.09em] text-indigo-200">
        {t('releaseNews.pinned.eyebrow')}
      </span>
      <h2
        id={titleId}
        className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl"
      >
        {t('releaseNews.pinned.title')}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
        {t('releaseNews.pinned.description')}
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {PINNED_PRODUCT_HIGHLIGHTS.map((feature, index) => {
          const Icon = icons[feature.id];
          return (
            <article
              key={feature.id}
              data-testid={`pinned-release-${feature.id}`}
              className="group flex min-w-0 flex-col rounded-[23px] border border-white/[0.09] bg-gradient-to-b from-white/[0.07] to-white/[0.025] p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-300/15 bg-indigo-400/[0.10] text-indigo-200">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span aria-hidden="true" className="font-mono text-[11px] text-white/25">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-white">
                {t(feature.titleKey)}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                {t(feature.descriptionKey)}
              </p>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-200/75">
                {t('releaseNews.how')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {t(feature.howKey)}
              </p>
              <div className="mt-auto pt-5">
                <Link
                  to={feature.action.to}
                  onClick={onAction}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-300/15 bg-indigo-400/[0.11] px-3 py-2.5 text-sm font-semibold text-indigo-100 transition hover:border-indigo-300/35 hover:bg-indigo-400/[0.19] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
                >
                  {t('releaseNews.viewFeature')}
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
