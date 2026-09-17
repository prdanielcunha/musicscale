import { describe, expect, it } from 'vitest';
import { repairChordImportFidelity } from '../../utils/chordImportFidelityRepair';
import { normalizePastedSongText } from '../../utils/textNormalizer';

describe('AI chord import fidelity repair', () => {
  it('rejoins chord fragments that mobile clipboard split before a lyric', () => {
    const input = `[Refrão]\nG#m7    D#m7    E9\nB\nLinha sintética A\nG#m7    D#m7    F#/A#    E9\nB\nLinha sintética B`;

    const repaired = repairChordImportFidelity(input);

    expect(repaired).toContain('G#m7    D#m7    E9    B\nLinha sintética A');
    expect(repaired).toContain('G#m7    D#m7    F#/A#    E9    B\nLinha sintética B');
    expect(repaired).not.toMatch(/\nB\nLinha sintética/);
  });

  it('rejoins a parenthesized progression without changing chord spelling', () => {
    const input = `[Refrão]\n( G#m7    E9    B\nF# )\n[Segunda Parte]\nG#m7    E9\nLinha sintética`;

    const repaired = repairChordImportFidelity(input);

    expect(repaired).toContain('( G#m7    E9    B    F# )');
    expect(repaired).toContain('[Segunda Parte]');
    expect(repaired).toContain('G#m7    E9\nLinha sintética');
  });

  it('preserves explicit section titles and restores only a missing leading Intro', () => {
    const input = `G#m7    E9    B    F#4\nG#m7    E9    B    F#4\n\n[Primeira Parte]\nG#m7    E9\nLinha A\n\n[Pré-Refrão]\nG#m7\nLinha B\n\n[Refrão]\nG#m7    D#m7    E9    B\nLinha C\n\n[Segunda Parte]\nG#m7    E9\nLinha D`;

    const repaired = repairChordImportFidelity(input);

    expect(repaired).toContain('[Intro]\nG#m7    E9    B    F#4');
    expect(repaired.match(/\[Intro\]/g)).toHaveLength(1);
    expect(repaired.match(/\[Primeira Parte\]/g)).toHaveLength(1);
    expect(repaired.match(/\[Pré-Refrão\]/g)).toHaveLength(1);
    expect(repaired.match(/\[Refrão\]/g)).toHaveLength(1);
    expect(repaired.match(/\[Segunda Parte\]/g)).toHaveLength(1);
  });

  it('runs after proven clipboard corruption and removes duplicate lyric boundaries', () => {
    const corrupted = `[Intro] G#m7    E9    B\n\">F#4\n\n        G#m7    E9    B\n\">F#4\n\n[Primeira Parte]\nG#m7\nLinha sintética\n\">E9\nLinha sintética\n\n[Refrão]\nG#m7    D#m7    E9\nB\nLinha final`;

    const { text, transformations } = normalizePastedSongText(corrupted);

    expect(transformations).toContain('normalized_chord_structure');
    expect(transformations).toContain('repaired_chord_import_fidelity');
    expect(text.match(/Linha sintética/g)).toHaveLength(1);
    expect(text).toContain('[Intro]');
    expect(text).toContain('[Primeira Parte]');
    expect(text).toContain('[Refrão]');
    expect(text).toContain('G#m7    D#m7    E9    B\nLinha final');
    expect(text).not.toContain('\">');
  });
});
