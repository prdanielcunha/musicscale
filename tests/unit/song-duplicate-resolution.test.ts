import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSongContentReplacementPatch } from '../../utils/songReplacement';

describe('song duplicate resolution and replacement contract', () => {
  it('replaces musical content but never rewrites identity/history fields', () => {
    const patch = buildSongContentReplacementPatch({
      id: 'incoming-id',
      organizationId: 'incoming-org',
      title: '  Promessas  ',
      artist: 'Sarah Beatriz',
      key: 'G#m',
      bpm: 72,
      lyrics: 'nova letra',
      chords: '[Intro]\nG#m E B F#',
      sections: ['Intro'],
      tabs: [{ section: 'Solo', content: 'e|--4--|' }],
      metadata: { source: 'ai' },
      createdAt: 'old-created-at',
      lastPlayed: '2026-09-01',
    } as any);

    expect(patch).toMatchObject({
      title: 'Promessas',
      artist: 'Sarah Beatriz',
      key: 'G#m',
      selectedKey: 'G#m',
      bpm: 72,
      lyrics: 'nova letra',
      chords: '[Intro]\nG#m E B F#',
      sections: ['Intro'],
      tabs: [{ section: 'Solo', content: 'e|--4--|' }],
      metadata: { source: 'ai' },
    });

    expect(patch).not.toHaveProperty('id');
    expect(patch).not.toHaveProperty('organizationId');
    expect(patch).not.toHaveProperty('createdAt');
    expect(patch).not.toHaveProperty('createdBy');
    expect(patch).not.toHaveProperty('lastPlayed');
    expect(patch).not.toHaveProperty('lastScheduledAt');
  });

  it('clears stale arrangement data when the replacement does not provide it', () => {
    const patch = buildSongContentReplacementPatch({
      title: 'Nova versão',
      artist: 'Artista',
      key: 'C',
    });

    expect(patch.sections).toEqual([]);
    expect(patch.tabs).toEqual([]);
    expect(patch.metadata).toEqual({});
    expect(patch.lyrics).toBe('');
    expect(patch.chords).toBe('');
    expect(patch.aiProcessed).toBe(false);
  });

  it('wires replacement into both manual creation and AI import flows', () => {
    const modalContext = fs.readFileSync(path.join(process.cwd(), 'contexts/ModalContext.tsx'), 'utf8');
    const aiImport = fs.readFileSync(path.join(process.cwd(), 'components/songs/AiSongImportModal.tsx'), 'utf8');
    const duplicateModal = fs.readFileSync(path.join(process.cwd(), 'components/songs/DuplicateSongModal.tsx'), 'utf8');

    expect(modalContext).toContain('api.replaceSongContent');
    expect(aiImport).toContain('api.replaceSongContent');
    expect(duplicateModal).toContain('onReplaceExisting');
    expect(duplicateModal).toContain("t('songDuplicate.confirmReplace')");
  });
});
