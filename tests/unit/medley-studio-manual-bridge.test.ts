import { describe, it, expect } from 'vitest';
import { serializeManualBridge, parseManualBridge, isBridgeChord } from '../../utils/medleyStudioManualBridge';

describe('Medley Studio non-destructive manual bridge', () => {
  it('roundtrips structured chord/bar durations in the existing performance cue', () => {
    const manual = { meter: '4/4' as const, bpm: 86, events: [
      { chord: 'Bbmaj7', bars: 2 }, { chord: 'F#7/C#', bars: 1 },
      { chord: 'Gm7', bars: 1 },
    ] };
    const cue = serializeManualBridge(manual);
    expect(cue).toBe('Ponte manual [4/4; 86 BPM]: Bbmaj7 × 2 | F#7/C# × 1 | Gm7 × 1');
    expect(parseManualBridge(cue)).toEqual(manual);
  });
  it('does not rewrite legacy free cues or user musical notes', () => {
    expect(parseManualBridge('Segurar a nota e entrar no refrão após a bateria')).toBeNull();
    expect(parseManualBridge('')).toBeNull();
  });
  it('validates slash chords, bars and BPM without guessing source chords', () => {
    expect(isBridgeChord('D/F#')).toBe(true);
    expect(isBridgeChord('C#m7b5')).toBe(true);
    expect(isBridgeChord('A letra do verso')).toBe(false);
    expect(() => serializeManualBridge({ meter: '6/8', events: [{ chord: 'G7', bars: 0 }] })).toThrow('medleyStudioV2.invalidBridge');
    expect(() => serializeManualBridge({ meter: '3/4', bpm: 600, events: [{ chord: 'G7', bars: 2 }] })).toThrow('medley.invalidBpm');
  });
  it('rejects oversized bridges instead of corrupting existing cue max length', () => {
    const events = Array.from({ length: 13 }, () => ({ chord: 'Abmaj7/C', bars: 8 }));
    expect(() => serializeManualBridge({ meter: '4/4', events })).toThrow('medleyStudioV2.invalidBridge');
  });
});
