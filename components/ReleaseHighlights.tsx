import React from 'react';
import { useTranslation } from 'react-i18next';
import { PinnedReleaseHighlights } from './PinnedReleaseHighlights';
import { RELEASE_DETAIL_GROUPS } from '../lib/releaseSpotlight';

interface ReleaseHighlightsProps {
  onAction?: () => void;
}

type Refinement = { date: string; text: string };

function isRefinement(value: unknown): value is Refinement {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Refinement>;
  return typeof row.date === 'string' && typeof row.text === 'string';
}

/**
 * A product showcase first; non-feature updates stay inside the second,
 * deliberately collapsed section. Do not gate the highlights on release age,
 * modal acknowledgment, latest version, or the changelog API.
 */
export function ReleaseHighlights({ onAction }: ReleaseHighlightsProps) {
  const { t } = useTranslation();

  return (
    <div className="pb-8 sm:pb-10">
      <PinnedReleaseHighlights onAction={onAction} />

      <details
        data-testid="secondary-release-updates"
        className="group mt-7 rounded-[22px] border border-white/[0.08] bg-black/25 px-5 py-4 sm:px-6"
      >
        <summary className="cursor-pointer list-none rounded-lg py-2 text-sm font-semibold text-white/78 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/55">
          <span className="flex items-center justify-between gap-3">
            <span>{t('releaseNews.pinned.otherUpdates')}</span>
            <span aria-hidden="true" className="text-xl font-normal text-indigo-200/70 transition-transform group-open:rotate-45">+</span>
          </span>
          <span className="mt-1 block text-xs font-normal text-white/45">
            {t('releaseNews.pinned.otherDescription')}
          </span>
        </summary>

        <div className="mt-4 space-y-7 border-t border-white/[0.08] pt-5">
          {RELEASE_DETAIL_GROUPS.map((releaseKey) => {
            const prefix = `releaseNews.${releaseKey}`;
            const translated = t(`${prefix}.refinements.items`, { returnObjects: true });
            const refinements = Array.isArray(translated)
              ? translated.filter(isRefinement)
              : [];
            if (refinements.length === 0) return null;

            return (
              <section key={releaseKey} className="space-y-3">
                <h3 className="text-sm font-semibold text-white/85">
                  {t(`${prefix}.refinements.title`)}
                </h3>
                <ol className="space-y-3">
                  {refinements.map((entry, index) => (
                    <li key={`${releaseKey}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-xs leading-relaxed text-white/60">
                      <time className="min-w-12 font-mono text-white/35">{entry.date}</time>
                      <span>{entry.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </details>
    </div>
  );
}
