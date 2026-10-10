import type { ScaleMedley } from '../types';
import { medleyPerformanceText } from './medleyPerformanceText';
import { parseManualBridge } from './medleyStudioManualBridge';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

const presentationBridge = (cue: string): string => {
  const bridge = parseManualBridge(cue);
  if (!bridge) return '<footer>' + escapeHtml(cue) + '</footer>';
  return '<footer class="bridge" aria-label="Ponte manual"><span class="bridge-meta">' +
    escapeHtml(bridge.meter + (bridge.bpm ? ' · ' + bridge.bpm + ' BPM' : '')) +
    '</span><div class="bridge-events">' +
    bridge.events.map(event => '<span class="bridge-event"><strong>' + escapeHtml(event.chord) +
      '</strong><small>' + event.bars + ' ×</small></span>').join('') +
    '</div></footer>';
};

/** Portable, script-free presentation from the approved offline snapshots. */
export function medleyPresentationHtml(medley: ScaleMedley, language = 'pt'): string {
  const lang = language.startsWith('en') ? 'en' : language.startsWith('es') ? 'es' : 'pt';
  const slides = medley.steps.map((step, index) => `<section class="slide"><header>${index + 1} / ${medley.steps.length} · ${escapeHtml(step.title)}${step.label ? ` · ${escapeHtml(step.label)}` : ''}</header><div class="meta">${step.key ? escapeHtml(step.key) : ''}${step.bpm ? ` · ${step.bpm} BPM` : ''} · ${step.repetitions}×</div><pre>${escapeHtml(medleyPerformanceText(step))}</pre>${(step.tabs || []).map(tab => `<div class="tab"><strong>${escapeHtml(tab.section)}</strong><pre>${escapeHtml(tab.content)}</pre></div>`).join('')}${step.transition?.cue ? presentationBridge(step.transition.cue) : ''}</section>`).join('\n');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Medley</title><style>html,body{margin:0;background:#090b12;color:#fff;font-family:system-ui,sans-serif}.slide{box-sizing:border-box;min-height:100vh;padding:5vh 7vw;page-break-after:always;break-after:page;display:flex;flex-direction:column}header{font-size:clamp(1rem,2vw,2rem);color:#b7adff}.meta{margin:1rem 0;color:#bbb}pre{font:clamp(1rem,2.2vw,2rem)/1.45 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;flex:1}footer{color:#b7adff}.bridge-events{display:flex;flex-wrap:wrap;gap:1rem;margin-top:1rem}.bridge-event{display:inline-flex;flex-direction:column;min-width:5rem;border:1px solid #615ac7;border-radius:12px;padding:1rem;text-align:center}.bridge-event strong{font-size:clamp(1.1rem,2vw,1.7rem);color:#fff}.bridge-event small{font-size:0.85rem;color:#bbb}@media print{.slide{min-height:100vh}}</style></head><body>${slides}</body></html>`;
}
