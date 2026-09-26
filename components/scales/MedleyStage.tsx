import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScaleMedley } from '../../types';

/** Reads only the approved snapshot. Scrolling or advancing never triggers sound. */
export function MedleyStage({ medley }: { medley: ScaleMedley; key?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(0);
  const [round, setRound] = useState(1);
  const step = medley.steps[position];
  const advance = () => {
    if (round < step.repetitions) setRound(round + 1);
    else if (position < medley.steps.length - 1) { setPosition(position + 1); setRound(1); }
  };
  const back = () => {
    if (round > 1) setRound(round - 1);
    else if (position > 0) { setPosition(position - 1); setRound(medley.steps[position - 1].repetitions); }
  };
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'ArrowRight') advance();
      if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open, position, round, medley]);

  return <>
    <button type="button" className="w-full rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4 text-left text-white" onClick={() => { setPosition(0); setRound(1); setOpen(true); }}>
      <strong>{t('medley.title')} · {medley.steps.map(item => item.title).join(' → ')}</strong>
      <span className="mt-1 block text-xs text-white/60">{t('medley.openStage')}</span>
    </button>
    {open && step && <div role="dialog" aria-modal="true" aria-label={t('medley.title')} className="fixed inset-0 z-[120] flex flex-col bg-[#090b12] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div><p className="text-xs uppercase tracking-widest text-indigo-300">{t('medley.title')} · {position + 1}/{medley.steps.length}</p><h2 className="text-xl font-bold">{step.title}{step.label ? ` · ${step.label}` : ''}</h2></div>
        <button type="button" className="rounded-xl border border-white/20 px-3 py-2" onClick={() => setOpen(false)} aria-label={t('medley.close')}>×</button>
      </header>
      <div className="flex flex-wrap gap-3 border-b border-white/10 px-4 py-2 text-sm text-white/70">
        {step.key && <span>{t('medley.key')}: {step.key}</span>}{step.bpm && <span>{step.bpm} BPM</span>}
        <span>{t('medley.round')} {round}/{step.repetitions}</span>
        {position < medley.steps.length - 1 && <span>{t('medley.next')}: {medley.steps[position + 1].title}</span>}
      </div>
      <main className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-10">
        <pre className="overflow-x-auto whitespace-pre font-mono text-base leading-8 sm:text-lg" style={{ tabSize: 4 }}>{step.snapshot}</pre>
        {step.sourceUrl && /^https?:\/\//i.test(step.sourceUrl) && <a className="mt-4 inline-block text-indigo-300 underline" href={step.sourceUrl} target="_blank" rel="noopener noreferrer">{t('medley.openSource')}</a>}
        {step.tabs?.map((tab, index) => <section key={`${tab.section}-${index}`} className="mt-6"><h3 className="font-bold">{tab.section}</h3><pre className="overflow-x-auto whitespace-pre font-mono text-sm">{tab.content}</pre></section>)}
        {position < medley.steps.length - 1 && <div className="mt-8 rounded-xl border border-indigo-400/20 p-4 text-indigo-200">{t('medley.transition')}: {t(`medley.${step.transition?.mode || 'direct'}`)} {step.transition?.cue && `· ${step.transition.cue}`}</div>}
      </main>
      <footer className="flex gap-3 border-t border-white/10 bg-[#090b12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" disabled={!position && round === 1} className="min-h-12 flex-1 rounded-xl border border-white/20 disabled:opacity-40" onClick={back}>{t('medley.previous')}</button>
        <button type="button" disabled={position === medley.steps.length - 1 && round === step.repetitions} className="min-h-12 flex-1 rounded-xl bg-indigo-500 font-bold disabled:opacity-40" onClick={advance}>{t('medley.next')}</button>
      </footer>
    </div>}
  </>;
}
