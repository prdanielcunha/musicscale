import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScaleMedley } from '../../types';
import { useLiveWorshipSession } from '../../hooks/useLiveWorshipSession';
import { useLiveDirectionFollow } from '../../hooks/useLiveDirectionFollow';
import { resolveMedleyDirection } from '../../utils/medleyDirection';
import Metronome from '../common/Metronome';
import { medleyPresentationHtml } from '../../utils/medleyPresentation';
import { medleyPerformanceText } from '../../utils/medleyPerformanceText';
import StagePadPlayer from '../songs/StagePadPlayer';
import { useAuth } from '../../contexts/AuthContext';

/** Reads only the approved snapshot. Scrolling or advancing never triggers sound. */
export function MedleyStage({ medley, scaleId, publishRevision }: { medley: ScaleMedley; scaleId?: string; publishRevision?: number; key?: string }) {
  const { t, i18n } = useTranslation();
  const { user, effectiveOrganizationId } = useAuth();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(0);
  const [round, setRound] = useState(1);
  const [directionError, setDirectionError] = useState(false);
  const [clickStepId, setClickStepId] = useState<string | null>(null);
  const [padStepId, setPadStepId] = useState<string | null>(null);
  const lastSequence = useRef(0);
  const directionInFlight = useRef(false);
  const live = useLiveWorshipSession(open ? scaleId : undefined);
  const { isFollowingDirection, toggleFollowingDirection, setIsFollowingDirection } = useLiveDirectionFollow(open ? scaleId : undefined);
  const step = medley.steps[position];
  const stageRevisionChanged = !!live.liveSession?.activeMedley && live.liveSession.activeMedley.medleyId === medley.id &&
    live.liveSession.activeMedley.publishRevision !== publishRevision;
  const exportPresentation = () => {
    const url = URL.createObjectURL(new Blob([medleyPresentationHtml(medley, i18n?.resolvedLanguage || i18n?.language)], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `medley-${medley.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60)}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const sendDirection = async (stepId: string, nextRound: number): Promise<boolean> => {
    if (!publishRevision || directionInFlight.current) return false;
    directionInFlight.current = true;
    try { return await live.directMedleyStep(medley.id, stepId, nextRound, publishRevision); }
    finally { directionInFlight.current = false; }
  };
  const navigate = async (direction: -1 | 1) => {
    if (directionInFlight.current) return;
    let target = position;
    let nextRound = round + direction;
    if (nextRound > step.repetitions) { target++; nextRound = 1; }
    if (nextRound < 1) { target--; nextRound = medley.steps[target]?.repetitions || 1; }
    if (target < 0 || target >= medley.steps.length) return;
    if (live.isLive && live.canControlLiveSession && !stageRevisionChanged && publishRevision) {
      const sent = await sendDirection(medley.steps[target].id, nextRound);
      if (!sent) { setDirectionError(true); return; }
      setDirectionError(false);
      setIsFollowingDirection(true);
    } else if (live.isLive && !live.canControlLiveSession) {
      setIsFollowingDirection(false);
    }
    if (target !== position) { setClickStepId(null); setPadStepId(null); }
    setPosition(target);
    setRound(nextRound);
  };
  const jumpTo = async (index: number) => {
    if (directionInFlight.current) return;
    const destination = medley.steps[index];
    if (!destination || (index === position && round === 1)) return;
    if (live.isLive && live.canControlLiveSession && !stageRevisionChanged && publishRevision) {
      const sent = await sendDirection(destination.id, 1);
      if (!sent) { setDirectionError(true); return; }
      setDirectionError(false);
      setIsFollowingDirection(true);
    } else if (live.isLive && !live.canControlLiveSession) setIsFollowingDirection(false);
    setClickStepId(null);
    setPadStepId(null);
    setPosition(index);
    setRound(1);
  };
  useEffect(() => {
    if (!open || !live.isLive || !isFollowingDirection || stageRevisionChanged) return;
    const resolved = resolveMedleyDirection(medley, publishRevision, live.liveSession?.activeMedley, lastSequence.current, isFollowingDirection);
    if (!resolved) return;
    lastSequence.current = resolved.sequence;
    if (resolved.index !== position) { setClickStepId(null); setPadStepId(null); }
    setPosition(resolved.index);
    setRound(resolved.round);
  }, [open, live.isLive, live.liveSession?.activeMedley, isFollowingDirection, stageRevisionChanged, medley, publishRevision, position]);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'ArrowRight') void navigate(1);
      if (event.key === 'ArrowLeft') void navigate(-1);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open, position, round, medley, live.isLive, live.canControlLiveSession, stageRevisionChanged, publishRevision]);

  return <>
    <button type="button" className="w-full rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4 text-left text-white" onClick={() => { setPosition(0); setRound(1); setClickStepId(null); setPadStepId(null); lastSequence.current = 0; setOpen(true); }}>
      <strong>{t('medley.title')} · {medley.steps.map(item => item.title).join(' → ')}</strong>
      <span className="mt-1 block text-xs text-white/60">{t('medley.openStage')}</span>
    </button>
    {open && step && <div role="dialog" aria-modal="true" aria-label={t('medley.title')} className="fixed inset-0 z-[120] flex flex-col bg-[#090b12] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div><p className="text-xs uppercase tracking-widest text-indigo-300">{t('medley.title')} · {position + 1}/{medley.steps.length}</p><h2 className="text-xl font-bold">{step.title}{step.label ? ` · ${step.label}` : ''}</h2></div>
        <div className="flex gap-2"><button type="button" className="rounded-xl border border-white/20 px-3 py-2 text-xs" onClick={exportPresentation}>{t('medley.exportPresentation')}</button><button type="button" className="rounded-xl border border-white/20 px-3 py-2" onClick={() => setOpen(false)} aria-label={t('medley.close')}>×</button></div>
      </header>
      <div className="flex flex-wrap gap-3 border-b border-white/10 px-4 py-2 text-sm text-white/70">
        {step.key && <span>{t('medley.key')}: {step.key}</span>}{step.bpm && <span>{step.bpm} BPM</span>}
        <span>{t('medley.round')} {round}/{step.repetitions}</span>
        {position < medley.steps.length - 1 && <span>{t('medley.next')}: {medley.steps[position + 1].title}</span>}
      </div>
      <nav aria-label={t('medley.jumpTo')} className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 px-4 py-2">
        {medley.steps.map((item, index) => <button key={item.id} type="button" aria-current={index === position ? 'step' : undefined} className={`min-h-11 shrink-0 rounded-lg border px-3 text-xs ${index === position ? 'border-indigo-400 bg-indigo-500/20 text-white' : 'border-white/15 text-white/70'}`} onClick={() => void jumpTo(index)}>{index + 1}. {item.title}{item.label ? ` · ${item.label}` : ''}</button>)}
      </nav>
      {live.isLive && <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2 text-xs">
        <button type="button" aria-pressed={isFollowingDirection} onClick={toggleFollowingDirection} className="rounded-lg border border-white/20 px-3 py-2">{isFollowingDirection ? t('medley.following') : t('medley.freeNavigation')}</button>
        <span>{live.canControlLiveSession ? t('medley.conducting') : t('medley.followingLeader')}</span>
        {live.canControlLiveSession && publishRevision && !stageRevisionChanged && <button type="button" className="rounded-lg border border-indigo-400/30 px-3 py-2" onClick={async () => { if (directionInFlight.current) return; const sent = await sendDirection(step.id, round); setDirectionError(!sent); if (sent) setIsFollowingDirection(true); }}>{t('medley.broadcastCurrent')}</button>}
      </div>}
      {!live.isLive && live.canStartLiveSession && publishRevision && <button type="button" className="mx-4 my-2 self-start rounded-lg border border-indigo-400/30 px-3 py-2 text-xs" onClick={() => void live.activateSession('worship')}>{t('medley.startLive')}</button>}
      {(directionError || stageRevisionChanged) && <p role="alert" className="px-4 py-2 text-sm text-amber-300">{stageRevisionChanged ? t('medley.revisionChanged') : t('medley.directionFailed')}</p>}
      {(step.bpm || step.key) && <div className="border-b border-white/10 px-4 py-2 text-xs">
        <div className="flex flex-wrap gap-2">{step.bpm && <button type="button" className="rounded-lg border border-white/20 px-3 py-2" aria-expanded={clickStepId === step.id} onClick={() => { setPadStepId(null); setClickStepId(current => current === step.id ? null : step.id); }}>{clickStepId === step.id ? t('medley.hideClick') : t('medley.showClick')}</button>}
        {step.key && <button type="button" className="rounded-lg border border-white/20 px-3 py-2" aria-expanded={padStepId === step.id} onClick={() => { setClickStepId(null); setPadStepId(current => current === step.id ? null : step.id); }}>{padStepId === step.id ? t('medley.hidePad') : t('medley.showPad')}</button>}</div>
        <p className="mt-1 text-white/60">{t('medley.audioHelp')}</p>
        {clickStepId === step.id && <div className="mt-2 max-w-md"><Metronome key={step.id} initialBpm={step.bpm} /></div>}
        {padStepId === step.id && <div className="mt-2 max-h-[45vh] max-w-md overflow-y-auto"><StagePadPlayer key={step.id} songKey={step.key} userId={user?.uid} organizationId={effectiveOrganizationId} /></div>}
      </div>}
      <main className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-10">
        <pre className="overflow-x-auto whitespace-pre font-mono text-base leading-8 sm:text-lg" style={{ tabSize: 4 }}>{medleyPerformanceText(step)}</pre>
        {step.sourceUrl && /^https?:\/\//i.test(step.sourceUrl) && <a className="mt-4 inline-block text-indigo-300 underline" href={step.sourceUrl} target="_blank" rel="noopener noreferrer">{t('medley.openSource')}</a>}
        {step.tabs?.map((tab, index) => <section key={`${tab.section}-${index}`} className="mt-6"><h3 className="font-bold">{tab.section}</h3><pre className="overflow-x-auto whitespace-pre font-mono text-sm">{tab.content}</pre></section>)}
        {position < medley.steps.length - 1 && <div className="mt-8 rounded-xl border border-indigo-400/20 p-4 text-indigo-200">{t('medley.transition')}: {t(`medley.${step.transition?.mode || 'direct'}`)} {step.transition?.cue && `· ${step.transition.cue}`}</div>}
      </main>
      <footer className="flex gap-3 border-t border-white/10 bg-[#090b12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" disabled={!position && round === 1} className="min-h-12 flex-1 rounded-xl border border-white/20 disabled:opacity-40" onClick={() => void navigate(-1)}>{t('medley.previous')}</button>
        <button type="button" disabled={position === medley.steps.length - 1 && round === step.repetitions} className="min-h-12 flex-1 rounded-xl bg-indigo-500 font-bold disabled:opacity-40" onClick={() => void navigate(1)}>{t('medley.next')}</button>
      </footer>
    </div>}
  </>;
}
