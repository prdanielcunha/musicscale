import { describe, expect, it } from 'vitest';
import type { MedleyExcerpt, ScaleMedley, Song } from '../../types';
import {
  buildMedleyRepertoireSong, isSongForMedley, medleyRepertoireRepairPatch,
} from '../../utils/medleyRepertoireSong';

const source = (id: string, chords: string, lyrics = ''): Song => ({
  id, organizationId: 'org-1', title: 'Música ' + id, artist: 'Cantor ' + id,
  key: 'G', status: 'active', tagIds: [], chords, lyrics, tabs: [],
  chordsUrl: '', videoUrl: '', createdAt: '', createdBy: { uid: 'user-1' },
  lastPlayed: null,
});

const excerpt = (id: string, snapshot: string, patch: Partial<MedleyExcerpt> = {}): MedleyExcerpt => ({
  id, songId: id, title: 'Música ' + id,
  snapshot, sourceRevision: 'old',
  startLine: 0, endLine: snapshot.split('\n').length - 1, repetitions: 1,
  key: 'G', ...patch,
});

const medley = (...steps: MedleyExcerpt[]): ScaleMedley => ({
  id: 'arrangement-1', anchorSongId: steps[0].songId, revision: 1, steps,
});

describe('medley as normal repertoire song', () => {
  it('derives a separate lyrics document, selected repetitions and a faithful performance chart', () => {
    const original = source('A', '[Refrão]\nG       C\nDeus é fiel');
    const arranged = medley(
      excerpt('A', original.chords, { repetitions: 2 }),
      excerpt('B', 'Am   F\nEu confio', { songId: 'B', key: 'Am' }),
    );
    const result = buildMedleyRepertoireSong(arranged, 'Meu Medley', [original, source('B', 'Am   F\nEu confio')]);
    expect(result.sourceType).toBe('medley');
    expect(result.chords).toContain('G       C\nDeus é fiel');
    expect(result.chords).toContain('Am   F\nEu confio');
    expect(result.lyrics).not.toContain('G       C');
    expect(result.lyrics.match(/Deus é fiel/g)).toHaveLength(2);
    expect(result.lyrics).toContain('Eu confio');
    expect(result.metadata?.medley?.arrangementId).toBe('arrangement-1');
    expect(original.chords).toBe('[Refrão]\nG       C\nDeus é fiel');
  });

  it('uses independent lyrics only for a full chart, without mismatching selected lines', () => {
    const original = source('A', 'G   C\nD   G', 'Eu te amo\nSenhor');
    const full = medley(excerpt('A', original.chords));
    expect(buildMedleyRepertoireSong(full, 'Medley', [original]).lyrics).toContain('Eu te amo');
    const partial = medley(excerpt('A', 'G   C', { endLine: 0 }));
    expect(() => buildMedleyRepertoireSong(partial, 'Medley', [original]))
      .toThrow('medleyStudioV2.sectionLyricsUnavailable');
  });

  it('transposes only the chart and retains approved snapshots', () => {
    const step = excerpt('A', 'G   C\nEu creio', { sourceKey: 'G', key: 'A' });
    const original = step.snapshot;
    const result = buildMedleyRepertoireSong(medley(step), 'Medley', [source('A', original)]);
    expect(result.chords).toContain('A   D\nEu creio');
    expect(result.lyrics).toContain('Eu creio');
    expect(step.snapshot).toBe(original);
  });

  it('repairs historical approved snapshots even if source records have disappeared', () => {
    const archived = medley(excerpt('A', 'G C\nMeu louvor'));
    expect(buildMedleyRepertoireSong(archived, 'Medley antigo', []).lyrics).toContain('Meu louvor');
  });

  it('never fabricates lyrics from chord-only selections', () => {
    const arranged = medley(excerpt('A', 'G C\nD Em'));
    expect(() => buildMedleyRepertoireSong(arranged, 'Medley', [source('A', 'G C\nD Em')]))
      .toThrow('medleyStudioV2.noLyricsDetected');
  });

  it('repairs empty lyrics without losing hand-edited chords or unrelated fields', () => {
    const arranged = medley(excerpt('A', 'G C\nEu creio'));
    const generated = buildMedleyRepertoireSong(arranged, 'Medley', [source('A', 'G C\nEu creio')]);
    const existing: Song = {
      ...source('saved', 'C G\narranjo manual'),
      id: 'saved', sourceType: 'medley', lyrics: '', tagIds: ['tag-1'],
      metadata: generated.metadata,
    };
    expect(isSongForMedley(existing, arranged.id)).toBe(true);
    const patch = medleyRepertoireRepairPatch(existing, generated);
    expect(patch?.lyrics).toBe(generated.lyrics);
    expect(patch?.chords).toBeUndefined();
    expect(patch?.tagIds).toBeUndefined();
    expect(existing.tagIds).toEqual(['tag-1']);
    expect(medleyRepertoireRepairPatch({ ...existing, lyrics: 'Minha edição manual' }, generated)).toBeNull();
  });

  it('does not match unrelated songs by title or overwrite user-created lyrics', () => {
    const arranged = medley(excerpt('A', 'G C\nEu creio'));
    const generated = buildMedleyRepertoireSong(arranged, 'Medley', [source('A', 'G C\nEu creio')]);
    const existing: Song = {
      ...source('other', 'G C\nEu creio'), title: 'Medley',
      metadata: { medley: { arrangementId: 'different' } },
    };
    expect(isSongForMedley(existing, arranged.id)).toBe(false);
    expect(() => medleyRepertoireRepairPatch(existing, generated)).toThrow();
  });
});
