import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PopulatedSong, MedleyExcerpt, ScaleMedley } from '../../types';
import { medleyChart, medleySourceRevision, medleyTabsForSelection } from '../../utils/medleyModel';
import { selectMedleyLines, splitMedleySource, suggestMedleySegments } from '../../utils/medleySegments';
import { isValidKey, normalizeKey, resolveChordContentSourceKey } from '../../utils/chordEngine';
import { suggestMedleyTransition } from '../../utils/medleyTransitions';
import { medleyPerformanceText } from '../../utils/medleyPerformanceText';

interface DraftStep {
  id: string;
  songId: string;
  startLine: number;
  endLine: number;
  label: string;
  repetitions: number;
  transition: 'direct' | 'hold' | 'pause' | 'free';
  cue: string;
  key: string;
  bpm: string;
}

interface Props {
  songs: PopulatedSong[];
  medleys: ScaleMedley[];
  onChange: (medleys: ScaleMedley[]) => void;
  onSaveTemplate?: (medley: ScaleMedley, name: string) => Promise<void>;
}

export function MedleyComposer({ songs, medleys, onChange, onSaveTemplate }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [error, setError] = useState('');
  const [approveChangedSources, setApproveChangedSources] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const songFor = (id: string) => songs.find(song => song.id === id);
  const whole = (song: PopulatedSong): DraftStep => ({
    id: crypto.randomUUID(), songId: song.id, startLine: 0,
    endLine: splitMedleySource(medleyChart(song)).length - 1,
    label: '', repetitions: 1, transition: 'direct', cue: '', key: song.key || '', bpm: song.bpm ? String(song.bpm) : '',
  });
  const start = (medley?: ScaleMedley) => {
    setEditingId(medley?.id || null);
    setSteps(medley ? medley.steps.map(step => ({
      id: step.id, songId: step.songId, startLine: step.startLine, endLine: step.endLine,
      label: step.label || '', repetitions: step.repetitions,
      transition: step.transition?.mode || 'direct', cue: step.transition?.cue || '', key: step.key || '', bpm: step.bpm ? String(step.bpm) : '',
    })) : songs.slice(0, 2).map(whole));
    setError('');
    setApproveChangedSources(false);
    setOpen(true);
  };
  const update = (index: number, patch: Partial<DraftStep>) =>
    setSteps(current => current.map((step, at) => at === index ? { ...step, ...patch } : step));
  const save = () => {
    try {
      const previous = medleys.find(item => item.id === editingId);
      const changed = previous?.steps.some(item => {
        const source = songFor(item.songId);
        return source && medleySourceRevision(source) !== item.sourceRevision;
      });
      if (changed && !approveChangedSources) throw new Error(t('medley.reviewRequired'));
      if (steps.length < 2) throw new Error(t('medley.minimum'));
      const otherSongIds = new Set(medleys.filter(item => item.id !== editingId).flatMap(item => item.steps.map(step => step.songId)));
      if (steps.some(step => otherSongIds.has(step.songId))) throw new Error(t('medley.alreadyGrouped'));
      const excerpts: MedleyExcerpt[] = steps.map(step => {
        const song = songFor(step.songId);
        if (!song) throw new Error(t('medley.missingSong'));
        const source = medleyChart(song);
        if (!source.trim() && !song.chordsUrl && !song.tabs?.length) throw new Error(t('medley.requiresText'));
        if (!source.trim() && (step.startLine !== 0 || step.endLine !== 0)) throw new Error(t('medley.invalidRange'));
        if (step.key.trim() && !isValidKey(step.key.trim())) throw new Error(t('medley.invalidKey'));
        if (step.bpm.trim() && (!Number.isInteger(Number(step.bpm)) || Number(step.bpm) < 20 || Number(step.bpm) > 320)) throw new Error(t('medley.invalidBpm'));
        const snapshot = selectMedleyLines(source, step.startLine, step.endLine);
        const tabs = medleyTabsForSelection(song, step.startLine, step.endLine, step.label);
        const sourceKey = resolveChordContentSourceKey(song.metadata)?.canAutoConfirm
          ? resolveChordContentSourceKey(song.metadata)!.key : undefined;
        if (step.key.trim() && sourceKey && normalizeKey(step.key.trim()) !== normalizeKey(sourceKey) &&
            (sourceKey.endsWith('m') !== step.key.trim().endsWith('m') || tabs.length)) throw new Error(t('medley.unsafeKeyChange'));
        if (step.key.trim() && song.chords?.trim() && !sourceKey && normalizeKey(step.key.trim()) !== normalizeKey(song.key || '')) throw new Error(t('medley.unverifiedSourceKey'));
        if (step.key.trim() && sourceKey && normalizeKey(step.key.trim()) !== normalizeKey(sourceKey) && !song.chords?.trim()) throw new Error(t('medley.unverifiedSourceKey'));
        return {
          id: step.id, songId: song.id, sourceRevision: medleySourceRevision(song),
          startLine: step.startLine, endLine: step.endLine, title: song.title,
          ...(step.label.trim() ? { label: step.label.trim() } : {}),
          repetitions: step.repetitions, ...(step.key.trim() ? { key: step.key.trim() } : {}),
          ...(sourceKey && song.chords?.trim() ? { sourceKey } : {}),
          ...(song.chordsUrl ? { sourceUrl: song.chordsUrl } : {}),
          ...(step.bpm.trim() ? { bpm: Number(step.bpm) } : {}), snapshot,
          ...(tabs.length ? { tabs } : {}),
          transition: { mode: step.transition, ...(step.cue.trim() ? { cue: step.cue.trim() } : {}) },
        };
      });
      const medley: ScaleMedley = {
        id: previous?.id || crypto.randomUUID(), anchorSongId: excerpts[0].songId,
        revision: (previous?.revision || 0) + 1, steps: excerpts,
      };
      onChange([...medleys.filter(item => item.id !== editingId), medley]);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('medley.invalid'));
    }
  };

  if (songs.length < 2 && !medleys.length) return null;
  return (
    <section className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-slate-800 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h4 className="font-bold">{t('medley.title')}</h4><p className="text-xs text-slate-500 dark:text-slate-400">{t('medley.description')}</p></div>
        {songs.length >= 2 && <button type="button" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white" onClick={() => start()}>{t('medley.create')}</button>}
      </div>
      {medleys.map(medley => <div key={medley.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/70 p-3 text-sm dark:bg-black/20">
        <span>{t('medley.title')} · {medley.steps.map(step => step.title).join(' → ')}</span>
        <div className="flex gap-3"><button type="button" className="text-primary underline" onClick={() => start(medley)}>{t('medley.edit')}</button>{onSaveTemplate && <button type="button" className="text-primary underline" onClick={() => { setTemplateId(medley.id); setTemplateName(medley.steps.map(step => step.title).join(' → ')); }}>{t('medley.saveTemplate')}</button>}<button type="button" className="text-rose-500 underline" onClick={() => onChange(medleys.filter(item => item.id !== medley.id))}>{t('medley.separate')}</button></div>
        {templateId === medley.id && <div className="flex w-full gap-2"><input className="input-base flex-1" maxLength={120} aria-label={t('medley.templateName')} value={templateName} onChange={event => setTemplateName(event.target.value)} /><button type="button" disabled={savingTemplate || !templateName.trim()} onClick={async () => { setSavingTemplate(true); try { await onSaveTemplate?.(medley, templateName.trim()); setTemplateId(null); setError(''); } catch { setError(t('medley.templateSaveFailed')); } finally { setSavingTemplate(false); } }} className="rounded-lg bg-primary px-3 text-white disabled:opacity-40">{t('medley.save')}</button><button type="button" onClick={() => setTemplateId(null)}>{t('medley.cancel')}</button></div>}
      </div>)}
      {error && !open && <p role="alert" className="mt-2 text-xs text-rose-500">{error}</p>}
      {open && <div role="dialog" aria-modal="true" aria-label={t('medley.title')} className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 sm:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-[#1C1C1E] sm:p-6">
          <h3 className="text-lg font-bold">{t('medley.title')}</h3>
          <p className="mb-4 text-sm text-slate-500">{t('medley.selectHelp')}</p>
          {medleys.find(item => item.id === editingId)?.steps.some(item => { const song = songFor(item.songId); return song && medleySourceRevision(song) !== item.sourceRevision; }) &&
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <strong>{t('medley.sourceChanged')}</strong>
              {medleys.find(item => item.id === editingId)?.steps.filter(item => { const song = songFor(item.songId); return song && medleySourceRevision(song) !== item.sourceRevision; }).map(item => <details key={item.id} className="mt-2"><summary>{item.title} · {item.label || t('medley.excerpt')}</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><span>{t('medley.approved')}</span><pre className="max-h-48 overflow-auto whitespace-pre font-mono text-xs">{item.snapshot}</pre></div><div><span>{t('medley.current')}</span><pre className="max-h-48 overflow-auto whitespace-pre font-mono text-xs">{songFor(item.songId) ? medleyChart(songFor(item.songId)!) : ''}</pre></div></div></details>)}
              <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={approveChangedSources} onChange={event => setApproveChangedSources(event.target.checked)} />{t('medley.approveChange')}</label>
            </div>}
          <div className="space-y-4">{steps.map((step, index) => {
            const song = songFor(step.songId);
            const source = song ? medleyChart(song) : '';
            const lines = splitMedleySource(source);
            const segments = suggestMedleySegments(source);
            return <div key={step.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/15">
              <div className="mb-3 flex items-center justify-between gap-2"><strong>{index + 1}. {song?.title}</strong><div className="flex gap-2">
                <button type="button" aria-label={t('medley.moveUp')} disabled={!index} onClick={() => setSteps(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>↑</button>
                <button type="button" aria-label={t('medley.moveDown')} disabled={index === steps.length - 1} onClick={() => setSteps(current => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}>↓</button>
                <button type="button" aria-label={t('medley.remove')} disabled={steps.length <= 2} onClick={() => setSteps(current => current.filter(item => item.id !== step.id))}>×</button>
              </div></div>
              <label className="block text-xs">{t('medley.song')}<select className="input-base w-full" value={step.songId} onChange={event => { const next = songFor(event.target.value); if (next) update(index, { ...whole(next), id: step.id }); }}>{songs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
              <label className="mt-2 block text-xs">{t('medley.excerpt')}<select className="input-base w-full" value={step.startLine === 0 && step.endLine === lines.length - 1 ? 'all' : segments.find(segment => segment.startLine === step.startLine && segment.endLine === step.endLine)?.id || 'manual'} onChange={event => { if (event.target.value === 'all') update(index, { startLine: 0, endLine: lines.length - 1, label: '' }); const selected = segments.find(segment => segment.id === event.target.value); if (selected) update(index, { startLine: selected.startLine, endLine: selected.endLine, label: selected.label || '' }); }}>
                <option value="manual">{t('medley.manual')}</option><option value="all">{t('medley.whole')}</option>{segments.filter(segment => segment.startLine !== 0 || segment.endLine !== lines.length - 1).map(segment => <option key={segment.id} value={segment.id}>{segment.label || `${t('medley.lines')} ${segment.startLine + 1}–${segment.endLine + 1}`}</option>)}
              </select></label>
              <div className="mt-2 flex flex-wrap gap-2"><label className="text-xs">{t('medley.from')}<input disabled={!source.trim()} className="input-base w-20" type="number" min="1" max={lines.length} value={step.startLine + 1} onChange={event => update(index, { startLine: Number(event.target.value) - 1 })} /></label><label className="text-xs">{t('medley.to')}<input disabled={!source.trim()} className="input-base w-20" type="number" min="1" max={lines.length} value={step.endLine + 1} onChange={event => update(index, { endLine: Number(event.target.value) - 1 })} /></label>
                <label className="text-xs">{t('medley.repeat')}<input className="input-base w-16" type="number" min="1" max="8" value={step.repetitions} onChange={event => update(index, { repetitions: Number(event.target.value) })} /></label></div>
              <div className="mt-2 flex gap-2"><label className="text-xs">{t('medley.key')}<input className="input-base w-24" maxLength={24} value={step.key} onChange={event => update(index, { key: event.target.value })} /></label><label className="text-xs">BPM<input className="input-base w-24" type="number" min="20" max="320" value={step.bpm} onChange={event => update(index, { bpm: event.target.value })} /></label></div>
              {index < steps.length - 1 && <div className="mt-2 flex gap-2"><label className="text-xs">{t('medley.transition')}<select className="input-base" value={step.transition} onChange={event => update(index, { transition: event.target.value as DraftStep['transition'] })}>{(['direct', 'hold', 'pause', 'free'] as const).map(mode => <option key={mode} value={mode}>{t(`medley.${mode}`)}</option>)}</select></label><label className="flex-1 text-xs">{t('medley.cue')}<input className="input-base w-full" maxLength={300} value={step.cue} onChange={event => update(index, { cue: event.target.value })} /></label></div>}
              {index < steps.length - 1 && (() => { const hint = suggestMedleyTransition({ key: step.key, bpm: Number(step.bpm) || undefined }, { key: steps[index + 1].key, bpm: Number(steps[index + 1].bpm) || undefined }); return <p className="mt-2 text-xs text-slate-500">{t('medley.suggestion')}: {t(`medley.${hint.mode}`)}{hint.semitones !== undefined ? ` · ${hint.semitones > 0 ? '+' : ''}${hint.semitones} ${t('medley.semitones')}` : ''}{hint.bpmDelta !== undefined ? ` · ${hint.bpmDelta > 0 ? '+' : ''}${hint.bpmDelta} BPM` : ''}</p>; })()}
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre rounded-lg bg-slate-100 p-3 text-xs dark:bg-black/30">{source && step.startLine >= 0 && step.endLine >= step.startLine && step.endLine < lines.length ? (() => { try { return medleyPerformanceText({ snapshot: selectMedleyLines(source, step.startLine, step.endLine), sourceKey: resolveChordContentSourceKey(song?.metadata)?.canAutoConfirm ? resolveChordContentSourceKey(song?.metadata)!.key : undefined, key: step.key, tabs: song ? medleyTabsForSelection(song, step.startLine, step.endLine, step.label) : [] } as MedleyExcerpt); } catch { return t('medley.unsafeKeyChange'); } })() : t('medley.invalidRange')}</pre>
              {!source.trim() && song?.chordsUrl && <p className="text-xs text-amber-600">{t('medley.externalOnly')}</p>}
            </div>;
          })}</div>
          <div className="mt-3 flex flex-wrap gap-2">{songs.map(song => <button key={song.id} type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => setSteps(current => [...current, whole(song)])}>+ {song.title}</button>)}</div>
          {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
          <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)}>{t('medley.cancel')}</button><button type="button" className="rounded-xl bg-primary px-4 py-2 font-bold text-white" onClick={save}>{t('medley.use')}</button></div>
        </div>
      </div>}
    </section>
  );
}
