import React from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION, FEATURE_RELEASE } from '../lib/appRelease';

export function ReleaseHighlights() {
  const { t } = useTranslation();
  const prefix = FEATURE_RELEASE.translationKey;
  return (
    <section aria-labelledby="release-title" className="mb-12">
      <div className="mb-7 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{t('releaseNews.badge')}</span>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">v{FEATURE_RELEASE.version}</span>
      </div>
      <h2 id="release-title" className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-900 dark:text-white sm:text-6xl">{t(`${prefix}.title`)}</h2>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">{t(`${prefix}.description`)}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {(['navigation', 'workspace', 'updates'] as const).map((item, index) => (
          <article key={item} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-500/[0.07] to-transparent p-6 dark:border-white/[0.08]">
            <span aria-hidden="true" className="font-mono text-xs text-indigo-500 dark:text-indigo-300">0{index + 1}</span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{t(`${prefix}.${item}.title`)}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t(`${prefix}.${item}.body`)}</p>
            <p className="mt-6 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{t('releaseNews.how')}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t(`${prefix}.${item}.how`)}</p>
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">{t('releaseNews.currentVersion')} · v{APP_VERSION}</p>
    </section>
  );
}
