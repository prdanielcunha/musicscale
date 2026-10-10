import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { MedleyStudioV2 } from '../../components/scales/MedleyStudioV2';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, effectiveOrganizationId: 'org-1' }) }));
beforeEach(() => sessionStorage.clear());

const song = (id: string, chords: string): PopulatedSong => ({
  id, organizationId: 'org-1', title: id, artist: '', key: 'Am', status: 'active', tagIds: [],
  chords, lyrics: '', tabs: [], chordsUrl: '', videoUrl: '', createdAt: '', lastPlayed: null,
  createdBy: { uid: 'u1' } as PopulatedSong['createdBy'], tags: [],
});

describe('feature-isolated visual studio', () => {
  it('prioritizes a scale suggestion even beyond the first 75 catalog results', () => {
    const catalog = Array.from({ length: 80 }, (_, i) => song('Library ' + i, 'C G'));
    const priority = song('Priority', 'Am F');
    const onChange = vi.fn();
    render(<MedleyStudioV2 songs={[...catalog, priority]} medleys={[]} onChange={onChange} suggestedSongIds={['Priority']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Priority.*Am/ })).toBeInTheDocument();
    expect(within(dialog).getByText('0 / 30 medley.excerpt')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('starts an empty sequence from a scale; existing songs are suggestions and saving cannot mutate the scale', () => {
    const a = song('A', 'Am    F');
    const b = song('B', 'C    G');
    const onChange = vi.fn();
    render(<MedleyStudioV2 songs={[b, a]} medleys={[]} onChange={onChange} suggestedSongIds={['A','B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('0 / 30 medley.excerpt')).toBeInTheDocument();
    expect(within(dialog).getByText('medleyStudioV2.emptyTimeline')).toBeInTheDocument();
    expect(within(dialog).getByText('medleyStudioV2.scaleSuggestions')).toBeInTheDocument();
    expect(within(dialog).getByText('medley.use')).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /A.*Am/ }));
    expect(within(dialog).getByText('1 / 30 medley.excerpt')).toBeInTheDocument();
    expect(within(dialog).getByText('medley.use')).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: /B.*Am/ }));
    fireEvent.click(within(dialog).getByText('medley.use'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].steps.map((step: {songId: string}) => step.songId)).toEqual(['A','B']);
    expect(a.chords).toBe('Am    F');
    expect(b.chords).toBe('C    G');
  });
  it('creates A-B-A from copied blocks, supports undo/redo and keeps source intact', () => {
    const a = song('A', 'Am    F\nTexto A');
    const b = song('B', 'C   G\nTexto B');
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[a,b]} medleys={[]} onChange={onChange} initialSongIds={['A','B']} />);
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

  it('saves a new repertoire medley only as an explicitly named tenant-scoped template', async () => {
    const onSaveTemplate = vi.fn(async (_medley: ScaleMedley, _name: string) => {});
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<MedleyStudioV2 songs={[song('A', 'Am  F\\nAleluia'), song('B', 'C G\\nGlória')]} medleys={[]}
      onChange={onChange} onSaveTemplate={onSaveTemplate} onClose={onClose} initialSongIds={['A']} templateOnly launchImmediately />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 / 30 medley.excerpt')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByText('B'));
    fireEvent.change(within(dialog).getByLabelText('medley.templateName'), { target: { value: 'Adoração em sequência' } });
    fireEvent.click(within(dialog).getByText('medley.saveTemplate'));
    await waitFor(() => expect(onSaveTemplate).toHaveBeenCalledTimes(1));
    const [arrangement, name] = onSaveTemplate.mock.calls[0];
    expect(name).toBe('Adoração em sequência');
    expect(arrangement.steps.map((step: { songId: string }) => step.songId)).toEqual(['A','B']);
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('applies a harmonic suggestion only when explicitly clicked and stores it in the cue', () => {
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[song('A', 'Am F'), song('B', 'C G')]} medleys={[]} onChange={onChange} initialSongIds={['A','B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getAllByText('medleyStudioV2.useAsCue')[0]);
    fireEvent.click(within(dialog).getByText('medley.use'));
    const saved = onChange.mock.calls[0][0][0];
    expect(saved.steps[0].transition?.cue).toBe('F → C');
    expect(saved.steps[0].transition?.mode).toBe('free');
    expect(saved.steps[0].snapshot).toBe('Am F');
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
