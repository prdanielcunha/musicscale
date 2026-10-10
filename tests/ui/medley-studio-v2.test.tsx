import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { MedleyStudioV2 } from '../../components/scales/MedleyStudioV2';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const song = (id: string, chords: string): PopulatedSong => ({
  id, organizationId: 'org-1', title: id, artist: '', key: 'Am', status: 'active', tagIds: [],
  chords, lyrics: '', tabs: [], chordsUrl: '', videoUrl: '', createdAt: '', lastPlayed: null,
  createdBy: { uid: 'u1' } as PopulatedSong['createdBy'], tags: [],
});

describe('feature-isolated visual studio', () => {
  it('creates A-B-A from copied blocks, supports undo/redo and keeps source intact', () => {
    const a = song('A', 'Am    F\nTexto A');
    const b = song('B', 'C   G\nTexto B');
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[a,b]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('medleyStudioV2.timeline')).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'medleyStudioV2.duplicate' })[0]);
    expect(within(dialog).getByText('3 / 30 medley.excerpt')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'medleyStudioV2.undo' }));
    expect(within(dialog).getByText('2 / 30 medley.excerpt')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'medleyStudioV2.redo' }));
    fireEvent.click(within(dialog).getByText('medley.use'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0][0];
    expect(result.steps.map(item => item.songId)).toEqual(['A','A','B']);
    expect(result.steps[0].snapshot).toBe('Am    F\nTexto A');
    expect(a.chords).toBe('Am    F\nTexto A');
  });

  it('never saves a legacy approved medley when its source changed without consent', () => {
    const a = song('A', 'Am    F\nTexto A');
    const b = song('B', 'C    G\nTexto B');
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    const old: ScaleMedley = {
      id: 'm', anchorSongId: 'A', revision: 1,
      steps: [{ id: 's1', songId: 'A', sourceRevision: 'old', startLine: 0, endLine: 1,
        title: 'A', repetitions: 1, snapshot: 'Am E\nAntigo' },
      { id: 's2', songId: 'B', sourceRevision: 'old', startLine: 0, endLine: 1,
        title: 'B', repetitions: 1, snapshot: 'Bm E\nAntigo' }],
    };
    render(<MedleyStudioV2 songs={[a,b]} medleys={[old]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.edit'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('medley.use'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('medley.reviewRequired');
  });
});
