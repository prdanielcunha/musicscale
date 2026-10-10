/**
 * A reversible, explicitly approved manual harmonic passage.
 * Encodes to the EXISTING transition.cue text (<=300 characters); no server
 * schema or security-rule changes and no synthetic/scraped recordings.
 */
export type BridgeMeter = '4/4' | '3/4' | '6/8';
export interface ManualBridgeEvent { chord: string; bars: number }
export interface ManualBridge {
  meter: BridgeMeter;
  bpm?: number;
  events: ManualBridgeEvent[];
}
const BRIDGE_PREFIX = 'Ponte manual';
const ROOT = /^[A-G](?:#|b)?/;
const BASS = /\/[A-G](?:#|b)?$/;
const CHORD = /^[A-G](?:#|b)?(?:m(?:aj)?|maj|min|dim|aug|sus|add|M)?(?:[0-9a-zA-Z+#b°ø()\-]*)?(?:\/[A-G](?:#|b)?)?$/;

/** Reject lyrics, multiline strings, impossible bar counts and oversized cues. */
export function isBridgeChord(input: string): boolean {
  const chord = input.trim();
  if (!chord || chord.length > 24 || !ROOT.test(chord) || !CHORD.test(chord)) return false;
  // A blank root with a dangling slash or slash-like lyric must not pass.
  if (chord.includes('/') && !BASS.test(chord)) return false;
  return true;
}
export function serializeManualBridge(bridge: ManualBridge): string {
  if (!['4/4', '3/4', '6/8'].includes(bridge.meter)) throw new Error('medleyStudioV2.invalidBridge');
  if (bridge.bpm !== undefined && (!Number.isInteger(bridge.bpm) || bridge.bpm < 20 || bridge.bpm > 320)) throw new Error('medley.invalidBpm');
  if (!bridge.events.length || bridge.events.length > 12) throw new Error('medleyStudioV2.invalidBridge');
  for (const event of bridge.events) {
    if (!isBridgeChord(event.chord) || !Number.isInteger(event.bars) || event.bars < 1 || event.bars > 8) throw new Error('medleyStudioV2.invalidBridge');
  }
  const prefix = BRIDGE_PREFIX + ' [' + bridge.meter + (bridge.bpm ? '; ' + bridge.bpm + ' BPM' : '') + ']: ';
  const cue = prefix + bridge.events.map(e => e.chord.trim() + ' × ' + e.bars).join(' | ');
  if (cue.length > 300) throw new Error('medleyStudioV2.invalidBridge');
  return cue;
}
export function parseManualBridge(cue: string): ManualBridge | null {
  const match = /^Ponte manual \[(4\/4|3\/4|6\/8)(?:; (\d+) BPM)?\]: (.+)$/.exec(cue.trim());
  if (!match) return null;
  const events: ManualBridgeEvent[] = [];
  for (const raw of match[3].split(' | ')) {
    const evt = /^(.+?) × (\d+)$/.exec(raw);
    if (!evt) return null;
    events.push({ chord: evt[1], bars: Number(evt[2]) });
  }
  try {
    const result: ManualBridge = { meter: match[1] as BridgeMeter, ...(match[2] ? { bpm: Number(match[2]) } : {}), events };
    if (serializeManualBridge(result) !== cue.trim()) return null;
    return result;
  } catch { return null; }
}
