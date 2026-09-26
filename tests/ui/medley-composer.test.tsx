import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { MedleyComposer } from '../../components/scales/MedleyComposer';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const song = (id: string, chords: string): PopulatedSong => ({
  id, organizationId: 'org-1', title: id, artist: '', key: 'Am', status: 'active', tagIds: [],
  chords, lyrics: '', tabs: [], chordsUrl: '', videoUrl: '', createdAt: '', lastPlayed: null,
  createdBy: { uid: 'u1' } as PopulatedSong['createdBy'], tags: [],
});

describe('medley composer', () => {
  it('creates a medley with an unmarked song, repeated source and faithful snapshots', () => {
    const onChange = vi.fn<(value: ScaleMedley[]) => void>();
    render(<MedleyComposer songs={[song('A', 'Am   F\nTexto A'), song('B', 'C    G\nTexto B')]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    fireEvent.click(screen.getByText('+ A'));
    fireEvent.click(screen.getByText('medley.use'));
    const [medley] = onChange.mock.calls[0][0];
    expect(medley.steps.map(step => step.songId)).toEqual(['A', 'B', 'A']);
    expect(medley.steps.map(step => step.snapshot)).toEqual(['Am   F\nTexto A', 'C    G\nTexto B', 'Am   F\nTexto A']);
  });
});
