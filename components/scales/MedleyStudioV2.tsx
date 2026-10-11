import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Copy, Music2, Plus, Redo2, Trash2, Undo2, X } from 'lucide-react';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { medleyChart, medleySourceRevision } from '../../utils/medleyModel';
import { selectMedleyLines, splitMedleySource } from '../../utils/medleySource';
import { suggestMedleySegments } from '../../utils/medleySegments';
import { analyzeMedleyBridge } from '../../utils/medleyStudioHarmony';
import {
  buildStudioPerformancePreview, compileStudioMedley, duplicateStudioBlock, groupStudioSongs, moveStudioBlock, newStudioBlock, splitStudioBlock,
  previewStudioBlock, studioBlocksFromLegacy,
} from '../../utils/medleyStudioV2';
import type { StudioBlock } from '../../utils/medleyStudioV2';
import { ManualMedleyBridgeEditor } from './ManualMedleyBridgeEditor';
import { buildSearchIndex, searchSongs } from '../../utils/searchEngine';
import { useAuth } from '../../contexts/AuthContext';
import { clearStudioDraft, loadStudioDraft, saveStudioDraft } from '../../utils/medleyStudioDraft';

interface Props {
  songs: PopulatedSong[];
  medleys: ScaleMedley[];
  onChange: (medleys: ScaleMedley[]) => void;
  onSaveTemplate?: (medley: ScaleMedley, name: string) => Promise<void>;
  /** Existing scale song IDs are preferred; the studio may also add catalog songs. */
  initialSongIds?: string[];
  /** Suggestions for a scale are never silently inserted as sequence blocks. */
  suggestedSongIds?: string[];
  launchImmediately?: boolean;
  templateOnly?: boolean;
  onClose?: () => void;
  draftScope?: string;
  /** Optional existing template. This is copied to a NEW version, never overwritten. */
  initialMedley?: ScaleMedley;
  initialTemplateName?: string;
}
interface History {
  past: StudioBlock[][];
  present: StudioBlock[];
  future: StudioBlock[][];
}
const button = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-35';
const field = 'min-h-[44px] w-full rounded-xl border border-white/15 bg-[#151d2b] px-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-sky-400';
const trim = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
const artworkPalettes = [
  'from-blue-600/60 via-indigo-800/50 to-[#090f1c]',
  'from-amber-700/45 via-rose-950/60 to-[#090f1c]',
  'from-teal-600/40 via-slate-800/70 to-[#090f1c]',
  'from-violet-700/40 via-blue-950/60 to-[#090f1c]',
] as const;
function artworkClass(songId: string): string {
  let hash = 0;
  for (let i = 0; i < songId.length; i++) hash = ((hash * 31) + songId.charCodeAt(i)) >>> 0;
  return artworkPalettes[hash % artworkPalettes.length];
}

export function MedleyStudioV2({ songs, medleys, onChange, onSaveTemplate, initialSongIds, suggestedSongIds, launchImmediately = false, templateOnly = false, onClose, draftScope = 'repertoire', initialMedley, initialTemplateName }: Props) {
  const { t } = useTranslation();
  const { user, effectiveOrganizationId } = useAuth();
  const draftIdentity = user?.uid && effectiveOrganizationId ? { userId: user.uid, organizationId: effectiveOrganizationId, scope: draftScope } : null;
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
  const [draftEdited, setDraftEdited] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const goToStage = (next: 1 | 2 | 3 | 4) => {
    setStage(next);
    if (next === 4) setShowFullPreview(true);
    if (next === 3) {
      const boundary = history.present.find((block, i) => history.present[i + 1] && block.songId !== history.present[i + 1].songId);
      if (boundary) setActiveId(boundary.id);
    }
  };
  const [recoverableBlocks, setRecoverableBlocks] = useState<StudioBlock[] | null>(null);
  const hasLaunched = React.useRef(false);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  const steps = history.present;
  const songGroups = useMemo(() => groupStudioSongs(steps), [steps]);
  const fullPreview = useMemo(() => {
    if (!showFullPreview) return null;
    try { return buildStudioPerformancePreview(steps, songs); }
    catch (cause) {
      return { text: '', truncated: false, error: cause instanceof Error ? cause.message : 'medley.invalid' };
    }
  }, [showFullPreview, steps, songs]);
  const selectedIndex = steps.findIndex(item => item.id === activeId);
  const selected = selectedIndex >= 0 ? steps[selectedIndex] : steps[0];
  const songMap = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const activeSong = selected ? songMap.get(selected.songId) : undefined;
  const selectedPosition = selected ? steps.findIndex(step => step.id === selected.id) : -1;
  const selectedIsSongBoundary = selectedPosition >= 0 && !!steps[selectedPosition + 1] && steps[selectedPosition + 1].songId !== selected.songId;
  const sectionChoices = useMemo(() => activeSong ? suggestMedleySegments(medleyChart(activeSong)) : [], [activeSong]);
  const searchIndex = useMemo(() => buildSearchIndex(songs), [songs]);
  const filteredSongs = useMemo(() => {
    const matches = searchSongs(searchIndex, query).map(match => match.document.song);
    if (query.trim() || !suggestedSongIds?.length) return matches.slice(0, 75);
    const rank = new Map(suggestedSongIds.map((id, index) => [id, index]));
    return matches.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)).slice(0, 75);
  }, [searchIndex, query, suggestedSongIds]);
  const original = medleys.find(item => item.id === editingId) || (templateOnly && initialMedley?.id === editingId ? initialMedley : undefined);
  const changedSources = original?.steps.filter(step => {
    const song = songMap.get(step.songId);
    return !song || medleySourceRevision(song) !== step.sourceRevision;
  }) || [];

  const edit = (change: (previous: StudioBlock[]) => StudioBlock[]) => {
    setDraftEdited(true);
    setHistory(h => ({ past: [...h.past.slice(-39), h.present], present: change(h.present), future: [] }));
    setError('');
  };
  const undo = () => { setDraftEdited(true); setHistory(h => h.past.length
    ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h); };
  const redo = () => { setDraftEdited(true); setHistory(h => h.future.length
    ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); };
  const update = (id: string, change: Partial<StudioBlock>) =>
    edit(blocks => blocks.map(item => item.id === id ? { ...item, ...change } : item));
  const start = (medley?: ScaleMedley) => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const preferredSongs = [...new Set(initialSongIds || [])].map(id => songMap.get(id)).filter((song): song is PopulatedSong => !!song);
    const blocks = medley ? studioBlocksFromLegacy(medley) : preferredSongs.slice(0, 30).map(song => newStudioBlock(song));
    setHistory({ past: [], present: blocks, future: [] });
    setActiveId(blocks[0]?.id || null);
    setEditingId(medley?.id || null);
    setSourceApproved(false);
    setError('');
    setQuery('');
    setDraftEdited(false);
    setShowFullPreview(false);
    setStage(medley || preferredSongs.length ? 2 : 1);
    if (draftIdentity && typeof window !== 'undefined') {
      try { setRecoverableBlocks(loadStudioDraft(draftIdentity, new Set(songs.map(song => song.id)), window.sessionStorage)); }
      catch { setRecoverableBlocks(null); }
    } else setRecoverableBlocks(null);
    setTemplateName((initialTemplateName || medley?.steps.map(step => step.title).join(' → ') || preferredSongs.map(song => song.title).join(' → ') || '').slice(0, 120));
    setOpen(true);
  };
  React.useEffect(() => {
    if (launchImmediately && songs.length && !hasLaunched.current) {
      hasLaunched.current = true;
      start(initialMedley);
    }
  }, [launchImmediately, songs, initialMedley]);
  const close = () => { setOpen(false); previousFocusRef.current?.focus(); onClose?.(); };
  React.useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus({ preventScroll: true });
  }, [isOpen]);
  React.useEffect(() => {
    if (!isOpen) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase())) return;
      const el = event.target;
      // Retain native undo history in text fields and editable chord controls.
      if (el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable)) return;
      event.preventDefault();
      if (event.key.toLowerCase() === 'y' || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [isOpen, history.past, history.future, onClose]);
  React.useEffect(() => {
    if (!isOpen || !draftEdited || !draftIdentity || typeof window === 'undefined') return;
    try { saveStudioDraft(draftIdentity, steps, window.sessionStorage); } catch { /* browsing restrictions */ }
  }, [isOpen, draftEdited, history.present, user?.uid, effectiveOrganizationId, draftScope]);
  const add = (song: PopulatedSong) => {
    if (steps.length >= 30) return setError(t('medley.invalid'));
    const block = newStudioBlock(song);
    edit(previous => [...previous, block]);
    setActiveId(block.id);
  };
  const addSelectedPart = (blockId: string) => {
    if (steps.length >= 30 || !steps.some(block => block.id === blockId)) return;
    const occurrenceId = crypto.randomUUID();
    edit(previous => duplicateStudioBlock(previous, previous.findIndex(block => block.id === blockId), occurrenceId)
      .map(block => block.id === occurrenceId ? { ...block, repetitions: 1 } : block));
    setActiveId(occurrenceId);
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
      if (draftIdentity && typeof window !== 'undefined') {
        try { clearStudioDraft(draftIdentity, window.sessionStorage); } catch { /* browsing restrictions */ }
      }
      setDraftEdited(false);
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

  // Stage 2 places the editor inside the song card; stage 3 keeps bridge controls adjacent.
  const inspector = (selected && activeSong ? <>
              <p className="mb-2 text-sm font-semibold text-sky-300">{activeSong.title}</p>
              {stage === 2 && <div className="mb-3 rounded-xl border border-sky-400/15 bg-sky-500/5 p-3" role="group" aria-label={t('medleyStudioV2.sectionChoices')}>
                <p className="mb-2 text-xs font-semibold text-slate-200">{t('medleyStudioV2.sectionChoices')}</p>
                <div className="flex flex-wrap gap-2">{sectionChoices.slice(0, 24).map(section => {
                  const selectedSection = selected.startLine === section.startLine && selected.endLine === section.endLine;
                  return <button type="button" key={section.id} aria-pressed={selectedSection}
                    className={'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-sky-400 ' + (selectedSection ? 'border-sky-400 bg-sky-500/20 text-white' : 'border-white/15 bg-white/5 text-slate-200')}
                    onClick={() => update(selected.id, { startLine: section.startLine, endLine: section.endLine, label: section.label || '' })}>
                    {section.label || (section.source === 'whole' ? t('medley.whole') : t('medleyStudioV2.unmarkedPart'))}
                  </button>;
                })}</div>
                {sectionChoices.length > 24 && <p className="mt-2 text-xs text-slate-400">{t('medleyStudioV2.moreSections')}</p>}
                {sectionChoices.every(section => section.source !== 'section') && <p className="mt-2 text-xs text-amber-200">{t('medleyStudioV2.manualSectionHint')}</p>}
              </div>}
              <label className={stage === 3 ? 'hidden' : 'block text-xs'}>{t('medley.excerpt')}
                <select className={field} value={(() => { const lines = splitMedleySource(medleyChart(activeSong)); if (selected.startLine === 0 && selected.endLine === lines.length - 1) return 'all'; return suggestMedleySegments(medleyChart(activeSong)).find(s => s.startLine === selected.startLine && s.endLine === selected.endLine)?.id || 'manual'; })()}
                  onChange={e => { if (e.target.value === 'all') update(selected.id, { startLine: 0, endLine: splitMedleySource(medleyChart(activeSong)).length - 1, label: '' }); else { const segment = suggestMedleySegments(medleyChart(activeSong)).find(s => s.id === e.target.value); if (segment) update(selected.id, { startLine: segment.startLine, endLine: segment.endLine, label: segment.label || '' }); } }}>
                  <option value="manual">{t('medley.manual')}</option><option value="all">{t('medley.whole')}</option>
                  {suggestMedleySegments(medleyChart(activeSong)).filter(s => s.startLine !== 0 || s.endLine !== splitMedleySource(medleyChart(activeSong)).length - 1).map(s => <option key={s.id} value={s.id}>{s.label || s.id}</option>)}
                </select></label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className={stage === 3 ? 'hidden' : 'text-xs'}>{t('medley.from')}<input className={field} type="number" min={1} max={splitMedleySource(medleyChart(activeSong)).length} value={selected.startLine + 1} onChange={e => update(selected.id, { startLine: Number(e.target.value) - 1 })} /></label>
                <label className={stage === 3 ? 'hidden' : 'text-xs'}>{t('medley.to')}<input className={field} type="number" min={1} max={splitMedleySource(medleyChart(activeSong)).length} value={selected.endLine + 1} onChange={e => update(selected.id, { endLine: Number(e.target.value) - 1 })} /></label>
                <label className={stage === 3 ? 'hidden' : 'text-xs'}>{t('medley.repeat')}<input className={field} type="number" min={1} max={16} value={selected.repetitions} onChange={e => update(selected.id, { repetitions: Number(e.target.value) })} /></label>
                <label className={stage === 3 ? 'hidden' : 'text-xs'}>{t('medley.key')}<input className={field} maxLength={24} value={selected.key} onChange={e => update(selected.id, { key: e.target.value })} /></label>
                <label className={stage === 3 ? 'hidden' : 'text-xs'}>BPM<input className={field} type="number" min={20} max={320} value={selected.bpm} onChange={e => update(selected.id, { bpm: e.target.value })} /></label>
                <label className={stage !== 3 || !selectedIsSongBoundary ? 'hidden' : 'text-xs'}>{t('medley.transition')}<select className={field} value={selected.transition} onChange={e => update(selected.id, { transition: e.target.value as StudioBlock['transition'] })}>{(['direct', 'hold', 'pause', 'free'] as const).map(mode => <option value={mode} key={mode}>{t('medley.' + mode)}</option>)}</select></label>
              </div>
              <label className={stage !== 3 || !selectedIsSongBoundary ? 'hidden' : 'mt-2 block text-xs'}>{t('medley.cue')}<textarea className={field + ' min-h-[66px] py-2'} maxLength={300} value={selected.cue} onChange={e => update(selected.id, { cue: e.target.value })} /></label>
              <div className={stage !== 3 || !selectedIsSongBoundary ? 'hidden' : ''} key={selected.id}><ManualMedleyBridgeEditor cue={selected.cue} onApply={cue => update(selected.id, { cue, transition: 'free' })} /></div>
              {stage === 3 && !selectedIsSongBoundary && <p className="mt-3 text-xs text-slate-400">{t('medleyStudioV2.bridgeOnlyBetweenSongs')}</p>}
              <div className={stage === 3 ? 'hidden' : 'mt-3'}>
                <p className="mb-1 text-xs font-semibold">{t('medleyStudioV2.preview')}</p>
                <pre className="max-h-72 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-xs leading-5 text-white whitespace-pre">{preview(selected)}</pre>
              </div>
            </> : <p className="text-sm text-slate-400">{t('medleyStudioV2.chooseBlock')}</p>);

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
    {isOpen && createPortal(<div role="dialog" aria-modal="true" aria-label={t('medleyStudioV2.title')} className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-black/90 p-2 pb-[max(16px,env(safe-area-inset-bottom))] sm:p-5">
      <div className="mx-auto max-w-[1440px] rounded-2xl border border-white/10 bg-[#090f1c] p-3 shadow-2xl sm:p-5">
        <header className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-sky-300">{t('medleyStudioV2.studio')}</p><h2 className="text-xl font-bold">{t('medleyStudioV2.title')}</h2><p className="text-xs text-slate-400">{t('medleyStudioV2.noSourceMutation')}</p></div>
          <button type="button" className={button} aria-label={t('medley.close')} ref={closeButtonRef} onClick={close}><X size={18} /></button>
        </header>
        <nav aria-label={t('medleyStudioV2.progress')} className="mb-4 grid grid-cols-4 gap-1.5" data-testid="medley-studio-steps">
          {([1, 2, 3, 4] as const).map(number => <button
            key={number} type="button" disabled={number > stage}
            aria-current={number === stage ? 'step' : undefined}
            className={'min-h-[52px] rounded-xl border px-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-sky-400 sm:text-sm ' +
              (number === stage ? 'border-sky-400 bg-sky-500/15 text-sky-100' : number < stage ? 'border-white/20 bg-white/5 text-slate-200' : 'border-white/10 text-slate-500')}
            onClick={() => goToStage(number)}>
              <span className="block text-xs tabular-nums">{String(number).padStart(2, '0')}</span>
              <span>{t('medleyStudioV2.step' + number)}</span>
          </button>)}
        </nav>
        {recoverableBlocks && <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 p-3 text-sm">
          <span className="flex-1">{t('medleyStudioV2.recoverDraft')}</span>
          <button type="button" className={button} onClick={() => { setHistory({ past: [], present: recoverableBlocks, future: [] }); setActiveId(recoverableBlocks[0]?.id || null); setRecoverableBlocks(null); setDraftEdited(true); }}>{t('medleyStudioV2.restore')}</button>
          <button type="button" className={button} onClick={() => { if (draftIdentity) { try { clearStudioDraft(draftIdentity, window.sessionStorage); } catch { /* storage denied */ } } setRecoverableBlocks(null); }}>{t('medleyStudioV2.discard')}</button>
        </div>}
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
        <div className={stage === 3 ? 'grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]' : 'grid min-w-0 gap-3'}>
          <aside className={'min-w-0 rounded-xl border border-white/10 bg-[#101a2a] p-3 ' + (stage !== 1 ? 'hidden' : '')}>
            <h3 className="mb-2 font-semibold">{t('medleyStudioV2.library')}</h3>
            <input className={field} aria-label={t('medleyStudioV2.search')} placeholder={t('medleyStudioV2.search')} value={query} onChange={e => setQuery(e.target.value)} />
            {!!suggestedSongIds?.length && !query.trim() && <p className="mt-2 text-xs font-semibold text-sky-300">{t('medleyStudioV2.scaleSuggestions')}</p>}
            <div className="mt-2 max-h-[340px] space-y-1 overflow-auto lg:max-h-[58vh]">{filteredSongs.map(song => <button key={song.id} type="button" className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-transparent p-2 text-left hover:border-sky-500/30 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-sky-400" onClick={() => add(song)}>
              <span aria-hidden="true" className={'relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ' + artworkClass(song.id)}>
                <span className="h-7 w-7 rounded-full border border-white/25 bg-white/5 blur-[1px]" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{song.title}</strong>
                <small className="text-xs text-slate-400">{song.artist || '—'} · {song.key || '—'}{song.bpm ? ' · ' + song.bpm + ' BPM' : ''}</small>
                <span className="mt-1 flex flex-wrap gap-1 text-[10px] font-medium text-slate-300">
                  {!!song.chords?.trim() && <span className="rounded border border-white/15 px-1.5">{t('medleyStudioV2.hasChords')}</span>}
                  {!!song.lyrics?.trim() && <span className="rounded border border-white/15 px-1.5">{t('medleyStudioV2.hasLyrics')}</span>}
                  {!!song.sections?.length && <span className="rounded border border-white/15 px-1.5">{t('medleyStudioV2.hasSections')}</span>}
                </span>
              </span>
              <Plus size={18} className="shrink-0 text-sky-300" />
            </button>)}{filteredSongs.length === 0 && <p className="p-3 text-sm text-slate-400">{t('medleyStudioV2.emptySearch')}</p>}</div>
          </aside>

          <section className={'min-w-0 rounded-xl border border-white/10 bg-[#101a2a] p-3 ' + (stage !== 2 && stage !== 3 ? 'hidden' : '')} aria-label={t('medleyStudioV2.timeline')}>
            <h3 className="mb-2 font-semibold">{t('medleyStudioV2.timeline')}</h3>
            <div className={stage === 2 ? 'space-y-3' : 'max-h-[48vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[65vh]'}>
              {songGroups.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">{t('medleyStudioV2.emptyTimeline')}</p>}
              {songGroups.map((group, groupIndex) => {
                const song = songMap.get(group.songId);
                const last = group.blocks[group.blocks.length - 1];
                const following = songGroups[groupIndex + 1]?.blocks[0];
                const suggestion = stage === 3 && following ? analyzeMedleyBridge(preview(last), preview(following)) : null;
                return <React.Fragment key={group.blocks[0].id}>
                  <article data-testid="medley-song-card" data-song-id={group.songId} className="rounded-xl border border-white/15 bg-white/[.035] p-3">
                    <div className="mb-3 flex items-center gap-3">
                      <span aria-hidden="true" className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ' + artworkClass(group.songId)}><Music2 size={20} className="text-white/70" /></span>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">{groupIndex + 1} · {t('medleyStudioV2.music')}</span>
                        <strong className="block truncate text-sm">{song?.title || group.songId}</strong>
                        <p className="truncate text-xs text-slate-400">{song?.artist || '—'} · {song?.key || '—'}{song?.bpm ? ' · ' + song.bpm + ' BPM' : ''}</p>
                      </div>
                    </div>
                    <ol className="space-y-2" data-testid="medley-part-list">
                      {group.blocks.map((step, partIndex) => {
                        const index = group.startIndex + partIndex;
                        return <li key={step.id} data-testid="medley-part-row" className={'rounded-lg border p-2 ' + (selected?.id === step.id ? 'border-sky-400 bg-sky-600/15' : 'border-white/10 bg-white/5')}>
                          <button type="button" className="flex min-h-[40px] w-full items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-sky-400" onClick={() => setActiveId(step.id)}>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs tabular-nums">{partIndex + 1}</span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{step.label || t('medley.excerpt')}</strong><small className="text-xs text-slate-400">{step.repetitions}× · {step.key || '—'} · {t('medley.lines')} {step.startLine + 1}–{step.endLine + 1}</small></span>
                          </button>
                          <div className="mt-2 flex flex-wrap gap-1 border-t border-white/10 pt-2">
                            <button type="button" className={button} disabled={!index} aria-label={t('medley.moveUp')} onClick={() => edit(items => moveStudioBlock(items, index, index - 1))}><ArrowUp size={16} /></button>
                            <button type="button" className={button} disabled={index === steps.length - 1} aria-label={t('medley.moveDown')} onClick={() => edit(items => moveStudioBlock(items, index, index + 1))}><ArrowDown size={16} /></button>
                            <button type="button" className={button} disabled={steps.length >= 30} aria-label={t('medleyStudioV2.duplicate')} onClick={() => edit(items => duplicateStudioBlock(items, index))}><Copy size={16} /></button>
                            <button type="button" className={button} disabled={steps.length >= 30 || step.startLine >= step.endLine} aria-label={t('medleyStudioV2.split')} onClick={() => edit(items => splitStudioBlock(items, index, Math.floor((step.startLine + step.endLine) / 2)))}>{t('medleyStudioV2.splitShort')}</button>
                            <button type="button" className={button + ' text-rose-300'} aria-label={t('medley.remove')} onClick={() => { edit(items => items.filter(item => item.id !== step.id)); if (activeId === step.id) setActiveId(null); }}><Trash2 size={16} /></button>
                          </div>
                        </li>;
                      })}
                    </ol>
                    {stage === 2 && group.blocks.some(block => block.id === selected?.id) && <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3" data-testid="medley-inline-inspector"><h3 className="mb-2 text-sm font-semibold">{t('medleyStudioV2.inspector')}</h3>{inspector}</div>}
                    {stage === 2 && <button type="button" className={button + ' mt-3 w-full border-dashed border-sky-500/40 text-sky-200'} disabled={steps.length >= 30} onClick={() => addSelectedPart(last.id)}><Plus size={16} className="mr-2" />{t('medleyStudioV2.addPart')}</button>}
                  </article>
                  {suggestion && <div data-testid="medley-song-bridge" className="rounded-lg border border-sky-400/20 bg-sky-500/5 p-3 text-xs text-slate-300">
                    <p className="font-semibold text-sky-200">{t('medleyStudioV2.transition')}: {suggestion.exitChord || '?'} → {suggestion.entryChord || '?'}</p>
                    {suggestion.candidates.length ? suggestion.candidates.map(candidate => <div key={candidate.id} className="mt-2 flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-words">{candidate.chords.join(' – ')} <span className="text-sky-300">({t('medleyStudioV2.' + candidate.explanation)})</span></span><button type="button" className={button + ' min-h-[36px] text-xs'} onClick={() => update(last.id, { cue: candidate.chords.join(' → '), transition: 'free' })}>{t('medleyStudioV2.useAsCue')}</button></div>) : <p className="mt-2">{t('medleyStudioV2.manualOnly')}</p>}
                    <p className="mt-1 text-[10px]">{t('medleyStudioV2.advisoryOnly')}</p>
                  </div>}
                </React.Fragment>;
              })}
            </div>
          </section>
          {stage === 3 && <aside className="min-w-0 rounded-xl border border-white/10 bg-[#101a2a] p-3"><h3 className="mb-2 font-semibold">{t('medleyStudioV2.step3')}</h3>{inspector}</aside>}
        </div>
        {stage === 4 && <section className="mt-4 rounded-xl border border-white/10 bg-[#101a2a] p-3" data-testid="medley-studio-review">
          <h3 className="text-lg font-bold">{t('medleyStudioV2.step4')}</h3>
          <p className="mb-3 text-xs text-slate-400">{t('medleyStudioV2.reviewHint')}</p>
          <ol className="space-y-3">{songGroups.map((group, groupIndex) => {
             const song = songMap.get(group.songId);
             const last = group.blocks[group.blocks.length - 1];
             return <li key={group.blocks[0].id} data-testid="medley-review-song-card" className="rounded-xl border border-white/10 bg-white/5 p-3">
               <div className="mb-2 flex items-center gap-3">
                 <span className="rounded-lg bg-sky-500/15 px-2 py-1 text-xs font-bold text-sky-300">{groupIndex + 1}</span>
                 <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{song?.title || group.songId}</strong><p className="text-xs text-slate-400">{song?.artist || '—'} · {song?.key || '—'}{song?.bpm ? ' · ' + song.bpm + ' BPM' : ''}</p></div>
               </div>
               <ol className="space-y-1 border-l border-sky-500/30 pl-3">{group.blocks.map((block, partIndex) => <li key={block.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-black/15 px-2 py-2">
                 <span className="text-xs tabular-nums text-sky-300">{partIndex + 1}</span>
                 <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{block.label || t('medley.excerpt')}</strong><p className="text-xs text-slate-400">{block.repetitions}× · {block.key || '—'} · {block.bpm || '—'} BPM</p>{!!block.cue && <p className="break-words text-xs text-sky-200">→ {block.cue}</p>}</div>
                 <button type="button" className={button} onClick={() => { setActiveId(block.id); goToStage(2); }}>{t('medley.edit')}</button>
               </li>)}</ol>
               <button type="button" className={button + ' mt-3 w-full border-dashed border-sky-500/30 text-sky-200'} disabled={steps.length >= 30} onClick={() => { addSelectedPart(last.id); goToStage(2); }}><Plus size={16} className="mr-2" />{t('medleyStudioV2.addPart')}</button>
             </li>;
           })}</ol>
           <p className="mt-3 text-xs text-slate-400">{t('medleyStudioV2.draftNotPublished')}</p>
        </section>}
        {stage === 4 && <section className="mt-4 rounded-xl border border-white/10 bg-[#101a2a] p-3">
          <button type="button" className={button + ' w-full justify-between'} aria-expanded={showFullPreview} onClick={() => setShowFullPreview(value => !value)}>{t('medleyStudioV2.fullPreview')} <span>{showFullPreview ? '−' : '+'}</span></button>
          {showFullPreview && fullPreview && <div className="mt-3">
            {'error' in fullPreview && fullPreview.error
              ? <p role="alert" className="text-sm text-amber-300">{t(fullPreview.error)}</p>
              : <><pre className="max-h-[50vh] overflow-auto whitespace-pre rounded-lg bg-black/30 p-3 font-mono text-xs leading-6 text-slate-100">{fullPreview.text}</pre>
                {fullPreview.truncated && <p role="status" className="mt-2 text-xs text-amber-300">{t('medleyStudioV2.previewTruncated')}</p>}</>}
          </div>}
        </section>}
        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-400/40 p-3 text-sm text-rose-300">{error}</p>}
        <footer className="sticky bottom-0 z-10 mt-4 flex flex-wrap justify-end gap-2 border-t border-white/10 bg-[#090f1c] py-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          {templateOnly && <label className="min-w-[200px] flex-1 text-xs text-slate-300">{t('medley.templateName')}<input className={field} maxLength={120} value={templateName} onChange={e => setTemplateName(e.target.value)} /></label>}
          <button type="button" className={button} onClick={close}>{t('medley.cancel')}</button>
          {stage > 1 && <button type="button" className={button} onClick={() => goToStage((stage - 1) as 1 | 2 | 3)}>{t('medleyStudioV2.previous')}</button>}
          {stage === 2 && <button type="button" className={button} onClick={() => goToStage(1)}>{t('medleyStudioV2.addMusic')}</button>}
          {stage < 4 && <button type="button" className={button + ' border-sky-400 bg-sky-600'} disabled={stage === 1 ? steps.length < 1 : steps.length < 2} onClick={() => goToStage((stage + 1) as 2 | 3 | 4)}>{t('medleyStudioV2.next')}</button>}
          {stage === 4 && <button type="button" className={button + ' border-sky-400 bg-sky-600'} onClick={() => void save()} disabled={savingTemplate || steps.length < 2 || (templateOnly && !templateName.trim())}>{templateOnly ? t('medley.saveTemplate') : t('medley.use')}</button>}
        </footer>
      </div>
    </div>, document.body)}
  </section>;
}
