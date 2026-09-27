import { describe, it, expect, vi } from 'vitest';
import { getEffectiveKey, getEffectiveBpm, applyLocalScaleSongSettingsUpdate, normalizeScaleSongSettings, applyScaleSongSettings } from '../../utils/scaleSongSettings';

describe('scaleSongSettings logic', () => {
  it('1. escala local prevalece sobre Song', () => {
    const song = { id: 's1', title: 'Song 1', key: 'G' } as any;
    expect(getEffectiveKey(song, { key: 'A' })).toBe('A');
  });

  it('2. Song prevalece sobre originalKey', () => {
    const song = { id: 's1', title: 'Song 1', key: 'C', originalKey: 'D' } as any;
    expect(getEffectiveKey(song, undefined)).toBe('C');
  });

  it('3. originalKey é fallback', () => {
    const song = { id: 's1', title: 'Song 1', originalKey: 'E' } as any;
    expect(getEffectiveKey(song, undefined)).toBe('E');
  });

  it('3a. selectedKey confirmado prevalece sobre key divergente', () => {
    const song = {
      id: 's1',
      title: 'Galileu',
      key: 'C',
      selectedKey: 'Am',
      originalKey: 'C',
      chords: '[Intro] C Am F7M',
    } as any;

    expect(getEffectiveKey(song, undefined)).toBe('Am');
  });

  it('3b. ajuste local transpõe a partir do selectedKey confirmado quando key está divergente', () => {
    const song = {
      id: 's1',
      title: 'Galileu',
      key: 'C',
      selectedKey: 'G',
      originalKey: 'C',
      chords: '[Intro] G D Em C',
    } as any;

    const adjusted = applyScaleSongSettings(song, { key: 'A' });
    expect(adjusted.key).toBe('A');
    expect(adjusted.selectedKey).toBe('A');
    expect(adjusted.chords).toContain('[Intro]');
    expect(adjusted.chords).toContain('A E F#m D');
  });

  it('4. null permanece null (no setting)', () => {
    const result = normalizeScaleSongSettings(['s1'], { s1: { key: null } as any });
    expect(result['s1'].key).toBeNull();
  });

  it('5. BPM null permanece null', () => {
    const result = normalizeScaleSongSettings(['s1'], { s1: { bpm: null } as any });
    expect(result['s1'].bpm).toBeNull();
  });

  it('6. applyLocalScaleSongSettingsUpdate handles null', () => {
    const next = applyLocalScaleSongSettingsUpdate({}, 's1', null, null);
    expect(next['s1']).toBeUndefined(); 
    // Wait, if it receives null, my updated applyLocal deletes it? Let me check.
    // If it deletes it, then the form doesn't save null.
  });
  
  it('11. normalização preserva settings ativos', () => {
    const res = normalizeScaleSongSettings(['s1', 's2'], { s1: { key: 'G' }, s3: { key: 'A' } });
    expect(res['s1'].key).toBe('G');
    expect(res['s3']).toBeUndefined(); // s3 is orphan
  });
});
