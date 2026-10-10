import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Copy, Music2, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { medleyChart, medleySourceRevision } from '../../utils/medleyModel';
import { selectMedleyLines, splitMedleySource } from '../../utils/medleySource';
import { suggestMedleySegments } from '../../utils/medleySegments';
import { analyzeMedleyBridge } from '../../utils/medleyStudioHarmony';
import {
  compileStudioMedley, duplicateStudioBlock, moveStudioBlock, newStudioBlock,
  previewStudioBlock, studioBlocksFromLegacy,
} from '../../utils/medleyStudioV2';
import type { StudioBlock } from '../../utils/medleyStudioV2';

interface Props {
  songs: PopulatedSong[];
  medleys: ScaleMedley[];
  onChange: (medleys: ScaleMedley[]) => void;
  onSaveTemplate?: (medley: ScaleMedley, name: string) => Promise<void>;
  /** Existing scale song IDs are preferred; the studio may also add catalog songs. */
  initialSongIds?: string[];
  launchImmediately?: boolean;
  templateOnly?: boolean;
  onClose?: () => void;
}
interface History {
  past: StudioBlock[][];
  present: StudioBlock[];
  future: StudioBlock[][];
}
const button = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-35';
const field = 'min-h-[44px] w-full rounded-xl border border-white/15 bg-[#151d2b] px-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-sky-400';
const trim = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export function MedleyStudioV2({ songs, medleys, onChange, onSaveTemplate, initialSongIds, launchImmediately = false, templateOnly = false, onClose }: Props) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceApproved, setSourceApproved] = useState(false);
  const [error, setError] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const hasLaunched = React.useRef(false);

  const steps = history.present;
  const selectedIndex = steps.findIndex(item => item.id === activeId);
  const selected = selectedIndex >= 0 ? steps[selectedIndex] : steps[0];
  const songMap = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const activeSong = selected ? songMap.get(selected.songId) : undefined;
  const filteredSongs = useMemo(() => songs.filter(song => trim(song.title + ' ' + song.artist + ' ' + song.chords).includes(trim(query))).slice(0, 75), [songs, query]);
  const original = medleys.find(item => item.id === editingId);
  const changedSources = original?.steps.filter(step => {
    const song = songMap.get(step.songId);
    return !song || medleySourceRevision(song) !== step.sourceRevision;
  }) || [];

  const edit = (change: (previous: StudioBlock[]) => StudioBlock[]) => {
    setHistory(h => ({ past: [...h.past.slice(-39), h.present], present: change(h.present), future: [] }));
    setError('');
  };
  const undo = () => setHistory(h => h.past.length
    ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
  const redo = () => setHistory(h => h.future.length
    ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);
  const update = (id: string, change: Partial<StudioBlock>) =>
    edit(blocks => blocks.map(item => item.id === id ? { ...item, ...change } : item));
  const start = (medley?: ScaleMedley) => {
    const preferredSongs = [...new Set(initialSongIds || [])].map(id => songMap.get(id)).filter((song): song is PopulatedSong => !!song);
    const blocks = medley ? studioBlocksFromLegacy(medley) : (preferredSongs.length ? preferredSongs : songs.slice(0, 2)).slice(0, 30).map(song => newStudioBlock(song));
    setHistory({ past: [], present: blocks, future: [] });
    setActiveId(blocks[0]?.id || null);
    setEditingId(medley?.id || null);
    setSourceApproved(false);
    setError('');
    setQuery('');
    setTemplateName(medley?.steps.map(step => step.title).join(' → ') || preferredSongs.map(song => song.title).join(' → ') || '');
    setOpen(true);
  };
  React.useEffect(() => {
    if (launchImmediately && songs.length && !hasLaunched.current) {
      hasLaunched.current = true;
      start();
    }
  }, [launchImmediately, songs]);
  const close = () => { setOpen(false); onClose?.(); };
  const add = (song: PopulatedSong) => {
    if (steps.length >= 30) return setError(t('medley.invalid'));
    const block = newStudioBlock(song);
    edit(previous => [...previous, block]);
    setActiveId(block.id);
  };
  const save = async () => {
    if (savingTemplate) return;
    try {
      if (steps.some(step => medleys.some(item => item.id !== editingId && item.steps.some(s => s.songId === step.songId)))) {
        throw new Error('medley.alreadyGrouped');
      }
      const result = compileStudioMedley(steps, songs, original, sourceApproved);
      if (templateOnly) {
        if (!onSaveTemplate || !templateName.trim()) throw new Error('medleyStudioV2.templateNameRequired');
        setSavingTemplate(true);
        try { await onSaveTemplate(result, templateName.trim()); }
        catch { throw new Error('medley.templateSaveFailed'); }
        finally { setSavingTemplate(false); }
      } else {
        onChange([...medleys.filter(item => item.id !== editingId), result]);
      }
      close();
      setError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'medley.invalid';
      setError(message.startsWith('medley.') ? t(message) : message);
    }
  };
  const preview = (block: StudioBlock): string => {
    const source = songMap.get(block.songId);
    if (!source) return t('medley.missingSong');
    try { return previewStudioBlock(block, source); }
    catch { return t('medley.unsafeKeyChange'); }
  };

  if (!songs.length && !medleys.length) return null;

  return <section className="mt-4 rounded-2xl border border-sky-500/25 bg-[#0a1425] p-3 text-slate-100 sm:p-4" data-testid="medley-studio-v2">
    <div className="flex items-center justify-between gap-2">
      <div><h3 className="flex items-center gap-2 font-bold"><Music2 size={18} className="text-sky-400" />{t('medleyStudioV2.title')}</h3><p className="text-xs text-slate-400">{t('medleyStudioV2.subtitle')}</p></div>
      {songs.length >= 2 && <button type="button" className={button + ' bg-sky-600'} onClick={() => start()}>{t('medley.create')}</button>}
    </div>
    {medleys.map(medley => <div key={medley.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
      <div><strong>{medley.steps.map(s => s.title).join(' → ')}</strong><p className="text-xs text-slate-400">{medley.steps.length} {t('medley.excerpt')}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => start(medley)}>{t('medley.edit')}</button>
        {onSaveTemplate && <button type="button" className={button} onClick={() => { setTemplateId(medley.id); setTemplateName(medley.steps.map(s => s.title).join(' → ')); }}>{t('medley.saveTemplate')}</button>}
        <button type="button" className={button + ' text-rose-300'} onClick={() => onChange(medleys.filter(m => m.id !== medley.id))}>{t('medley.separate')}</button>
      </div>
      {templateId === medley.id && <div className="flex w-full flex-wrap gap-2"><input className={field + ' flex-1'} maxLength={120} aria-label={t('medley.templateName')} value={templateName} onChange={e => setTemplateName(e.target.value)} />
        <button type="button" className={button} disabled={savingTemplate || !templateName.trim()} onClick={async () => { setSavingTemplate(true); try { await onSaveTemplate?.(medley, templateName.trim()); setTemplateId(null); setError(''); } catch { setError(t('medley.templateSaveFailed')); } finally { setSavingTemplate(false); } }}>{t('medley.save')}</button>
        <button type="button" className={button} onClick={() => setTemplateId(null)}>{t('medley.cancel')}</button></div>}
    </div>)}
    {error && !isOpen && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    {isOpen && <div role="dialog" aria-modal="true" aria-label={t('medleyStudioV2.title')} className="fixed inset-0 z-[120] overflow-y-auto bg-black/90 p-2 pb-[max(16px,env(safe-area-inset-bottom))] sm:p-5">
      <div className="mx-auto max-w-[1440px] rounded-2xl border border-white/10 bg-[#090f1c] p-3 shadow-2xl sm:p-5">
        <header className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-sky-300">{t('medleyStudioV2.studio')}</p><h2 className="text-xl font-bold">{t('medleyStudioV2.title')}</h2><p className="text-xs text-slate-400">{t('medleyStudioV2.noSourceMutation')}</p></div>
          <button type="button" className={button} aria-label={t('medley.close')} onClick={close}><X size={18} /></button>
        </header>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className={button} onClick={undo} disabled={!history.past.length} aria-label={t('medleyStudioV2.undo')}><Undo2 size={17} /> <span className="ml-1">{t('medleyStudioV2.undo')}</span></button>
          <button type="button" className={button} onClick={redo} disabled={!history.future.length} aria-label={t('medleyStudioV2.redo')}><Redo2 size={17} /> <span className="ml-1">{t('medleyStudioV2.redo')}</span></button>
          <span className="self-center text-xs text-slate-400">{steps.length} / 30 {t('medley.excerpt')}</span>
        </div>
        {changedSources.length > 0 && <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3">
          <strong className="text-sm text-amber-200">{t('medley.sourceChanged')}</strong>
          {changedSources.map(step => <details key={step.id} className="mt-2 text-xs"><summary className="cursor-pointer">{step.title}</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><pre className="overflow-auto whitespace-pre p-2">{step.snapshot}</pre><pre className="overflow-auto whitespace-pre p-2">{medleyChart(songMap.get(step.songId) || ({ chords: '', lyrics: '' }))}</pre></div></details>)}
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={sourceApproved} onChange={e => setSourceApproved(e.target.checked)} />{t('medley.approveChange')}</label>
        </div>}
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(190px,.85fr)_minmax(240px,1.25fr)_minmax(240px,1fr)]">
          <aside className="min-w-0 rounded-xl border border-white/10 bg-[#101a2a] p-3">
            <h3 className="mb-2 font-semibold">{t('medleyStudioV2.library')}</h3>
            <input className={field} aria-label={t('medleyStudioV2.search')} placeholder={t('medleyStudioV2.search')} value={query} onChange={e => setQuery(e.target.value)} />
            <div className="mt-2 max-h-[340px] space-y-1 overflow-auto lg:max-h-[58vh]">{filteredSongs.map(song => <button key={song.id} type="button" className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-transparent p-2 text-left hover:border-sky-500/30 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-sky-400" onClick={() => add(song)}>
              <Plus size={16} className="shrink-0 text-sky-300" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{song.title}</strong><small className="text-xs text-slate-400">{song.artist} · {song.key || '—'}</small></span>
            </button>)}{filteredSongs.length === 0 && <p className="p-3 text-sm text-slate-400">{t('medleyStudioV2.emptySearch')}</p>}</div>
          </aside>
          <section className="min-w-0 rounded-xl border border-white/10 bg-[#101a2a] p-3" aria-label={t('medleyStudioV2.timeline')}>
            <h3 className="mb-2 font-semibold">{t('medleyStudioV2.timeline')}</h3>
            <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[65vh]">
              {steps.map((step, index) => {
                const song = songMap.get(step.songId);
                const next = steps[index + 1];
                const suggestion = next ? analyzeMedleyBridge(preview(step), preview(next)) : null;
                return <React.Fragment key={step.id}>
                  <div className={'rounded-xl border p-3 ' + (selected?.id === step.id ? 'border-sky-400 bg-sky-600/15' : 'border-white/10 bg-white/5')}>
                    <button type="button" className="w-full text-left focus-visible:outline-2 focus-visible:outline-sky-400" onClick={() => setActiveId(step.id)}>
                      <span className="text-[11px] uppercase tracking-widest text-sky-300">{index + 1} · {step.label || t('medley.excerpt')}</span>
                      <strong className="block truncate">{song?.title || step.songId}</strong>
                      <span className="text-xs text-slate-400">{step.key || '—'} · {step.repetitions}× · {t('medley.lines')} {step.startLine + 1}–{step.endLine + 1}</span>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" className={button} disabled={!index} aria-label={t('medley.moveUp')} onClick={() => edit(s => moveStudioBlock(s, index, index - 1))}><ArrowUp size={16} /></button>
                      <button type="button" className={button} disabled={index === steps.length - 1} aria-label={t('medley.moveDown')} onClick={() => edit(s => moveStudioBlock(s, index, index + 1))}><ArrowDown size={16} /></button>
                      <button type="button" className={button} disabled={steps.length >= 30} aria-label={t('medleyStudioV2.duplicate')} onClick={() => edit(s => duplicateStudioBlock(s, index))}><Copy size={16} /></button>
                      <button type="button" className={button + ' text-rose-300'} disabled={steps.length <= 2} aria-label={t('medley.remove')} onClick={() => { edit(s => s.filter(item => item.id !== step.id)); if (activeId === step.id) setActiveId(null); }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  {suggestion && <div className="rounded-lg border-l-2 border-sky-600 p-2 text-xs text-slate-400">
                    <p>{t('medleyStudioV2.transition')}: {suggestion.exitChord || '?'} → {suggestion.entryChord || '?'}</p>
                    {suggestion.candidates.length ? suggestion.candidates.map(candidate => <div key={candidate.id} className="mt-2 flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-words">{candidate.chords.join(' – ')} <span className="text-sky-300">({t('medleyStudioV2.' + candidate.explanation)})</span></span><button type="button" className={button + ' min-h-[36px] text-xs'} onClick={() => update(step.id, { cue: candidate.chords.join(' → '), transition: 'free' })}>{t('medleyStudioV2.useAsCue')}</button></div>) : <p>{t('medleyStudioV2.manualOnly')}</p>}
                    <p className="mt-1 text-[10px]">{t('medleyStudioV2.advisoryOnly')}</p>
                  </div>}
                </React.Fragment>;
              })}
            </div>
          </section>
          <aside className="min-w-0 rounded-xl border border-white/10 bg-[#101a2a] p-3">
            <h3 className="mb-2 font-semibold">{t('medleyStudioV2.inspector')}</h3>
            {selected && activeSong ? <>
              <p className="mb-2 text-sm font-semibold text-sky-300">{activeSong.title}</p>
              <label className="block text-xs">{t('medley.excerpt')}
                <select className={field} value={(() => { const lines = splitMedleySource(medleyChart(activeSong)); if (selected.startLine === 0 && selected.endLine === lines.length - 1) return 'all'; return suggestMedleySegments(medleyChart(activeSong)).find(s => s.startLine === selected.startLine && s.endLine === selected.endLine)?.id || 'manual'; })()}
                  onChange={e => { if (e.target.value === 'all') update(selected.id, { startLine: 0, endLine: splitMedleySource(medleyChart(activeSong)).length - 1, label: '' }); else { const segment = suggestMedleySegments(medleyChart(activeSong)).find(s => s.id === e.target.value); if (segment) update(selected.id, { startLine: segment.startLine, endLine: segment.endLine, label: segment.label || '' }); } }}>
                  <option value="manual">{t('medley.manual')}</option><option value="all">{t('medley.whole')}</option>
                  {suggestMedleySegments(medleyChart(activeSong)).filter(s => s.startLine !== 0 || s.endLine !== splitMedleySource(medleyChart(activeSong)).length - 1).map(s => <option key={s.id} value={s.id}>{s.label || s.id}</option>)}
                </select></label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs">{t('medley.from')}<input className={field} type="number" min={1} max={splitMedleySource(medleyChart(activeSong)).length} value={selected.startLine + 1} onChange={e => update(selected.id, { startLine: Number(e.target.value) - 1 })} /></label>
                <label className="text-xs">{t('medley.to')}<input className={field} type="number" min={1} max={splitMedleySource(medleyChart(activeSong)).length} value={selected.endLine + 1} onChange={e => update(selected.id, { endLine: Number(e.target.value) - 1 })} /></label>
                <label className="text-xs">{t('medley.repeat')}<input className={field} type="number" min={1} max={8} value={selected.repetitions} onChange={e => update(selected.id, { repetitions: Number(e.target.value) })} /></label>
                <label className="text-xs">{t('medley.key')}<input className={field} maxLength={24} value={selected.key} onChange={e => update(selected.id, { key: e.target.value })} /></label>
                <label className="text-xs">BPM<input className={field} type="number" min={20} max={320} value={selected.bpm} onChange={e => update(selected.id, { bpm: e.target.value })} /></label>
                <label className="text-xs">{t('medley.transition')}<select className={field} value={selected.transition} onChange={e => update(selected.id, { transition: e.target.value as StudioBlock['transition'] })}>{(['direct', 'hold', 'pause', 'free'] as const).map(mode => <option value={mode} key={mode}>{t('medley.' + mode)}</option>)}</select></label>
              </div>
              <label className="mt-2 block text-xs">{t('medley.cue')}<textarea className={field + ' min-h-[66px] py-2'} maxLength={300} value={selected.cue} onChange={e => update(selected.id, { cue: e.target.value })} /></label>
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold">{t('medleyStudioV2.preview')}</p>
                <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs leading-5 text-white whitespace-pre">{preview(selected)}</pre>
              </div>
            </> : <p className="text-sm text-slate-400">{t('medleyStudioV2.chooseBlock')}</p>}
          </aside>
        </div>
        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-400/40 p-3 text-sm text-rose-300">{error}</p>}
        <footer className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-2 border-t border-white/10 bg-[#090f1c] py-3 pb-[max(8px,env(safe-area-inset-bottom))]">
          {templateOnly && <label className="min-w-[200px] flex-1 text-xs text-slate-300">{t('medley.templateName')}<input className={field} maxLength={120} value={templateName} onChange={e => setTemplateName(e.target.value)} /></label>}
          <button type="button" className={button} onClick={close}>{t('medley.cancel')}</button>
          <button type="button" className={button + ' border-sky-400 bg-sky-600'} onClick={() => void save()} disabled={savingTemplate || steps.length < 2 || (templateOnly && !templateName.trim())}>{templateOnly ? t('medley.saveTemplate') : t('medley.use')}</button>
        </footer>
      </div>
    </div>}
  </section>;
}
