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

  it('stores the source chart and its verified key separately from the performance key', () => {
    const onChange = vi.fn<(value: ScaleMedley[]) => void>();
    const verified = { ...song('A', 'G   D/F#\nPromessa'), key: 'A', metadata: { chordContentKey: 'G' } };
    render(<MedleyComposer songs={[verified, song('B', 'Am\nTexto B')]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    fireEvent.click(screen.getByText('medley.use'));
    const step = onChange.mock.calls[0][0][0].steps[0];
    expect(step).toMatchObject({ key: 'A', sourceKey: 'G', snapshot: 'G   D/F#\nPromessa' });
  });

  it('does not guess a source key for a manually changed chart', () => {
    const onChange = vi.fn();
    render(<MedleyComposer songs={[song('A', 'Am   F\nTexto A'), song('B', 'C    G\nTexto B')]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    const keyInputs = screen.getAllByLabelText('medley.key');
    fireEvent.change(keyInputs[0], { target: { value: 'Gm' } });
    fireEvent.click(screen.getByText('medley.use'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('medley.unverifiedSourceKey');
  });
});
