import React from 'react';
import { AudioLines, Sparkles, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FEATURE_RELEASE } from '../lib/appRelease';

const featureCards = [
  { id: 'stageTools', icon: Wrench },
  { id: 'deviceAudio', icon: AudioLines },
  { id: 'updates', icon: Sparkles },
] as const;

export function ReleaseHighlights() {
  const { t } = useTranslation();
  const prefix = FEATURE_RELEASE.translationKey;

  return (
    <section aria-labelledby="release-title" className="pb-8 sm:pb-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-full border border-indigo-300/20 bg-indigo-400/[0.08] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-indigo-200">
          {t('releaseNews.badge')}
        </span>
      </div>

      <h2
        id="release-title"
        className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl"
      >
        {t(`${prefix}.title`)}
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">
        {t(`${prefix}.description`)}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {featureCards.map(({ id, icon: Icon }, index) => (
          <article
            key={id}
            className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-300/10 bg-indigo-400/[0.07] text-indigo-200">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="font-mono text-[10px] text-white/22" aria-hidden="true">
                0{index + 1}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-[-0.025em] text-white">
              {t(`${prefix}.${id}.title`)}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-white/48">
              {t(`${prefix}.${id}.body`)}
            </p>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.13em] text-indigo-200/75">
              {t('releaseNews.how')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/68">
              {t(`${prefix}.${id}.how`)}
            </p>
          </article>
        ))}
      </div>

      <details className="group mt-6 rounded-[22px] border border-white/[0.06] bg-black/20 px-5 py-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-white/66 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/50 rounded-lg">
          <span className="inline-flex items-center gap-2">
            <span>{t(`${prefix}.refinements.summary`)}</span>
            <span className="text-white/30 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </span>
        </summary>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <h3 className="text-sm font-semibold text-white/82">
            {t(`${prefix}.refinements.title`)}
          </h3>
          <ol className="mt-3 space-y-3">
            {[0, 1, 2].map((index) => (
              <li key={index} className="grid grid-cols-[auto_1fr] gap-3 text-xs leading-relaxed text-white/48">
                <time className="font-mono text-white/28">
                  {t(`${prefix}.refinements.items.${index}.date`)}
                </time>
                <span>{t(`${prefix}.refinements.items.${index}.text`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </section>
  );
}
