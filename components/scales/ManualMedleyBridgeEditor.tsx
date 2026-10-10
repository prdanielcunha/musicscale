import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  parseManualBridge, serializeManualBridge,
} from '../../utils/medleyStudioManualBridge';
import type { BridgeMeter, ManualBridge } from '../../utils/medleyStudioManualBridge';

const ctrl = 'min-h-[44px] min-w-[44px] rounded-xl border border-white/20 bg-[#121c2d] px-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-sky-400';
/** This editor is opt-in and only updates the current cue after pressing Apply. */
export function ManualMedleyBridgeEditor({ cue, onApply }: { cue: string; onApply: (cue: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ManualBridge>(() => parseManualBridge(cue) || {
    meter: '4/4', events: [{ chord: '', bars: 1 }],
  });
  const [error, setError] = useState('');
  const formatted = parseManualBridge(cue);
  const changeEvent = (index: number, update: { chord?: string; bars?: number }) =>
    setDraft(previous => ({ ...previous, events: previous.events.map((event, i) => i === index ? { ...event, ...update } : event) }));
  const apply = () => {
    try {
      const nextCue = serializeManualBridge(draft);
      onApply(nextCue);
      setError('');
      setOpen(false);
    } catch (cause) {
      const key = cause instanceof Error ? cause.message : 'medleyStudioV2.invalidBridge';
      setError(t(key));
    }
  };
  return <section className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3" aria-label={t('medleyStudioV2.manualBridge')}>
    <button type="button" className={ctrl + ' w-full text-left font-semibold text-sky-200'} aria-expanded={open} onClick={() => setOpen(v => !v)}>
      {t('medleyStudioV2.manualBridge')} {open ? '−' : '+'}
    </button>
    {formatted && <p className="mt-2 break-words text-xs text-slate-300">{cue}</p>}
    {open && <div className="mt-3 space-y-3">
      {cue.trim() && !formatted && <p className="text-xs text-amber-200" role="status">{t('medleyStudioV2.replacesCueOnlyOnApply')}</p>}
      <label className="block text-xs text-slate-200">{t('medleyStudioV2.meter')}
        <select className={ctrl + ' mt-1 w-full'} value={draft.meter} onChange={e => setDraft(prev => ({ ...prev, meter: e.target.value as BridgeMeter }))}>
          <option value="4/4">4/4</option><option value="3/4">3/4</option><option value="6/8">6/8</option>
        </select>
      </label>
      <label className="block text-xs text-slate-200">{t('medleyStudioV2.bridgeBpm')}
        <input className={ctrl + ' mt-1 w-full'} type="number" min="20" max="320" placeholder="—" value={draft.bpm || ''} onChange={e => setDraft(prev => ({ ...prev, bpm: e.target.value ? Number(e.target.value) : undefined }))} />
      </label>
      <div className="space-y-2" aria-label={t('medleyStudioV2.chordEvents')}>
        {draft.events.map((event, i) => <div className="flex flex-wrap items-end gap-2" key={i}>
          <label className="min-w-[98px] flex-[3] text-xs text-slate-200">{t('medleyStudioV2.chord')} {i + 1}
            <input className={ctrl + ' mt-1 w-full'} maxLength={24} value={event.chord} onChange={e => changeEvent(i, { chord: e.target.value })} placeholder="G7, Am7, D/F#" />
          </label>
          <label className="min-w-[65px] flex-1 text-xs text-slate-200">{t('medleyStudioV2.bars')}
            <input className={ctrl + ' mt-1 w-full'} type="number" min="1" max="8" value={event.bars} onChange={e => changeEvent(i, { bars: Number(e.target.value) })} />
          </label>
          <button className={ctrl} type="button" aria-label={t('medley.remove')} disabled={draft.events.length <= 1}
            onClick={() => setDraft(prev => ({ ...prev, events: prev.events.filter((_, at) => at !== i) }))}>−</button>
        </div>)}
      </div>
      <button className={ctrl + ' w-full'} type="button" disabled={draft.events.length >= 12}
        onClick={() => setDraft(prev => ({ ...prev, events: [...prev.events, { chord: '', bars: 1 }] }))}>
        + {t('medleyStudioV2.addChordEvent')}
      </button>
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      <button className={ctrl + ' w-full border-sky-400 bg-sky-600 font-semibold'} type="button" onClick={apply}>
        {t('medleyStudioV2.applyManualBridge')}
      </button>
      <p className="text-[11px] text-slate-400">{t('medleyStudioV2.bridgeNotPlayback')}</p>
    </div>}
  </section>;
}
