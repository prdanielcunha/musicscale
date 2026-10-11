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

function continueToReview(dialog: HTMLElement, current: 1 | 2 | 3) {
  for (let step = current; step < 4; step++) {
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
  }
}

describe('feature-isolated visual studio', () => {
  it('puts the mobile studio above the app shell rather than below its header and bottom dock', () => {
    const { container } = render(<MedleyStudioV2 songs={[song('A', 'Am F'), song('B', 'C G')]} medleys={[]} onChange={vi.fn()} initialSongIds={['A', 'B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toBe(document.body);
    expect(container.contains(dialog)).toBe(false);
    expect(within(dialog).getByRole('heading', { name: 'medleyStudioV2.title', level: 2 })).toBeVisible();
    expect(within(dialog).getByText('medleyStudioV2.next')).toBeVisible();
  });

  it('keeps focus in the section editor instead of jumping to the close button after editing', () => {
    const a = song('A', '[Intro]\\nAm F\\n[Refrão]\\nC G'.replaceAll('\\n', '\n'));
    render(<MedleyStudioV2 songs={[a, song('B', 'Dm G')]} medleys={[]} onChange={vi.fn()} initialSongIds={['A', 'B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'medley.close' })).toHaveFocus();
    const sections = within(dialog).getByRole('group', { name: 'medleyStudioV2.sectionChoices' });
    const sectionButton = within(sections).getByRole('button', { name: 'Refrão' });
    sectionButton.focus();
    fireEvent.click(sectionButton);
    expect(sectionButton).toHaveFocus();
    expect(sectionButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects section chips and duplicates an independent occurrence without modifying the song', () => {
    const a = song('A', '[Intro]\\nAm F\\n[Refrão]\\nC G'.replaceAll('\\n', '\n'));
    const b = song('B', 'Dm G');
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    const originalChart = a.chords;
    render(<MedleyStudioV2 songs={[a,b]} medleys={[]} onChange={onChange} initialSongIds={['A', 'B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    const sections = within(dialog).getByRole('group', { name: 'medleyStudioV2.sectionChoices' });
    fireEvent.click(within(sections).getByRole('button', { name: 'Refrão' }));
    const firstCard = within(dialog).getAllByTestId('medley-song-card')[0];
    expect(within(dialog).getAllByTestId('medley-song-card')).toHaveLength(2);
    expect(within(firstCard).getByTestId('medley-inline-inspector')).toBeInTheDocument();
    fireEvent.click(within(firstCard).getByRole('button', { name: 'medleyStudioV2.addPart' }));
    expect(within(dialog).getByText('3 / 30 medley.excerpt')).toBeInTheDocument();
    expect(within(dialog).getAllByTestId('medley-song-card')).toHaveLength(2);
    expect(within(within(dialog).getAllByTestId('medley-song-card')[0]).getAllByTestId('medley-part-row')).toHaveLength(2);
    expect(within(within(dialog).getAllByTestId('medley-song-card')[0]).getByTestId('medley-inline-inspector')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
    expect(within(dialog).getAllByTestId('medley-song-bridge')).toHaveLength(1);
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
    expect(within(dialog).getAllByTestId('medley-review-song-card')).toHaveLength(2);
    expect(within(within(dialog).getAllByTestId('medley-review-song-card')[0]).getAllByRole('button', { name: 'medley.edit' })).toHaveLength(2);
    fireEvent.click(within(dialog).getByText('medley.use'));
    const medley = onChange.mock.calls[0][0][0];
    expect(medley.steps.map(step => step.songId)).toEqual(['A', 'A', 'B']);
    expect(medley.steps[0].snapshot).toContain('[Refrão]');
    expect(medley.steps[1].snapshot).toBe(medley.steps[0].snapshot);
    expect(medley.steps[0].id).not.toBe(medley.steps[1].id);
    expect(a.chords).toBe(originalChart);
  });
  it('adds a new part within the same song from review, without creating an extra song card', () => {
    const a = song('A', '[Intro]\nAm F\n[Refrão]\nC G');
    const b = song('B', 'Dm G');
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[a, b]} medleys={[]} onChange={onChange} initialSongIds={['A', 'B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    continueToReview(dialog, 2);
    const reviewCard = within(dialog).getAllByTestId('medley-review-song-card')[0];
    fireEvent.click(within(reviewCard).getByRole('button', { name: 'medleyStudioV2.addPart' }));
    expect(within(dialog).getAllByTestId('medley-song-card')).toHaveLength(2);
    expect(within(within(dialog).getAllByTestId('medley-song-card')[0]).getAllByTestId('medley-part-row')).toHaveLength(2);
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
    expect(within(dialog).getAllByTestId('medley-song-bridge')).toHaveLength(1);
  });
  it('selects several parts with one tap each, sorts them by chart order and adjusts repetitions inline', () => {
    const a = song('A', '[Intro]\nAm F\n[Verso]\nG C\n[Refrão]\nF G');
    const b = song('B', 'Dm G');
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[a,b]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    const rowA = within(dialog).getAllByTestId('medley-picker-song').find(node => node.getAttribute('data-song-id') === 'A')!;
    fireEvent.click(within(rowA).getByRole('button', { name: /A.*Am/ }));
    let picker = within(rowA).getByTestId('medley-quick-sections');
    fireEvent.click(within(picker).getByRole('button', { name: 'Refrão' }));
    fireEvent.click(within(picker).getByRole('button', { name: 'Intro' }));
    picker = within(rowA).getByTestId('medley-quick-sections');
    expect(within(picker).getAllByTestId('medley-quick-arrangement')).toHaveLength(1);
    expect(within(picker).getByTestId('medley-quick-arrangement').textContent).toMatch(/Intro.*Refrão/);
    fireEvent.click(within(picker).getByRole('button', { name: 'medleyStudioV2.increaseRepeats 2' }));
    expect(within(picker).getByTestId('medley-quick-arrangement')).toHaveTextContent('2×');
    const rowB = within(dialog).getAllByTestId('medley-picker-song').find(node => node.getAttribute('data-song-id') === 'B')!;
    fireEvent.click(within(rowB).getByRole('button', { name: /B.*Am/ }));
    continueToReview(dialog, 1);
    fireEvent.click(within(dialog).getByText('medley.use'));
    const steps = onChange.mock.calls[0][0][0].steps;
    expect(steps.map(step => [step.songId, step.label, step.repetitions])).toEqual([
      ['A', 'Intro', 1], ['A', 'Refrão', 2], ['B', '', 1],
    ]);
    expect(a.chords).toBe('[Intro]\nAm F\n[Verso]\nG C\n[Refrão]\nF G');
  });

  it('reopening a chosen song edits its sections, while another appearance is inserted explicitly', () => {
    const a = song('A', '[Intro]\nAm F\n[Refrão]\nC G');
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[a,song('B','Dm G')]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    const rowA = within(dialog).getAllByTestId('medley-picker-song').find(node => node.getAttribute('data-song-id') === 'A')!;
    const rowB = within(dialog).getAllByTestId('medley-picker-song').find(node => node.getAttribute('data-song-id') === 'B')!;
    fireEvent.click(within(rowA).getByRole('button', { name: /A.*Am/ }));
    fireEvent.click(within(rowA).getByRole('button', { name: 'Intro' }));
    fireEvent.click(within(rowB).getByRole('button', { name: /B.*Am/ }));
    fireEvent.click(within(rowA).getByRole('button', { name: /A.*Am/ }));
    expect(within(rowA).getByTestId('medley-selection-count')).toHaveTextContent('1×');
    fireEvent.click(within(rowA).getByRole('button', { name: 'medleyStudioV2.addSongAgain' }));
    expect(within(rowA).getByTestId('medley-selection-count')).toHaveTextContent('2×');
    fireEvent.click(within(rowA).getByRole('button', { name: 'Refrão' }));
    continueToReview(dialog, 1);
    fireEvent.click(within(dialog).getByText('medley.use'));
    expect(onChange.mock.calls[0][0][0].steps.map(step => [step.songId, step.label]))
      .toEqual([['A', 'Intro'],['B',''],['A','Refrão']]);
  });

  it('marks selections live, shows A-B-A as two A appearances, removes an exact position, and supports undo', () => {
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[song('A', 'Am F'),song('B', 'C G'),song('C', 'Dm G')]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    const row = (id: string) => within(dialog).getAllByTestId('medley-picker-song').find(item => item.getAttribute('data-song-id') === id)!;
    fireEvent.click(within(row('A')).getByRole('button', { name: /A.*Am/ }));
    fireEvent.click(within(row('B')).getByRole('button', { name: /B.*Am/ }));
    fireEvent.click(within(row('A')).getByRole('button', { name: 'medleyStudioV2.addSongAgain' }));
    expect(within(row('A')).getByTestId('medley-selection-count')).toHaveTextContent('2×');
    expect(within(row('B')).getByTestId('medley-selection-count')).toHaveTextContent('1×');
    expect(within(row('A')).getAllByTestId('medley-picker-occurrence')).toHaveLength(2);
    expect(within(row('A')).getByText('#1')).toBeInTheDocument();
    expect(within(row('A')).getByText('#3')).toBeInTheDocument();
    expect(within(dialog).getByTestId('medley-selection-summary')).toHaveTextContent('3 medleyStudioV2.appearances');
    fireEvent.click(within(row('A')).getByRole('button', { name: 'medleyStudioV2.removeOccurrence A #1' }));
    expect(within(row('A')).getByTestId('medley-selection-count')).toHaveTextContent('1×');
    expect(within(row('A')).getByText('#2')).toBeInTheDocument();
    expect(within(row('B')).getByText('#1')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'medleyStudioV2.undo' }));
    expect(within(row('A')).getByTestId('medley-selection-count')).toHaveTextContent('2×');
    fireEvent.click(within(row('A')).getByRole('button', { name: 'medleyStudioV2.removeOccurrence A #3' }));
    expect(within(row('A')).getByTestId('medley-selection-count')).toHaveTextContent('1×');
    continueToReview(dialog, 1);
    fireEvent.click(within(dialog).getByText('medley.use'));
    expect(onChange.mock.calls[0][0][0].steps.map(step => step.songId)).toEqual(['A','B']);
  });

  it('keeps one occurrence for multiple parts of A and removes its entire card from the picker', () => {
    render(<MedleyStudioV2 songs={[song('A','[Intro]\\nAm F\\n[Refrão]\\nC G'.replaceAll('\\n','\n')), song('B','Dm G')]} medleys={[]} onChange={vi.fn()} initialSongIds={['A','B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    const card = within(dialog).getAllByTestId('medley-song-card')[0];
    fireEvent.click(within(card).getByRole('button', { name: 'medleyStudioV2.addPart' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'medleyStudioV2.addMusic' }));
    const rowA = within(dialog).getAllByTestId('medley-picker-song').find(item => item.getAttribute('data-song-id') === 'A')!;
    expect(within(rowA).getByTestId('medley-selection-count')).toHaveTextContent('1×');
    expect(within(rowA).getAllByTestId('medley-picker-occurrence')).toHaveLength(1);
    fireEvent.click(within(rowA).getByRole('button', { name: 'medleyStudioV2.removeOccurrence A #1' }));
    expect(within(rowA).queryByTestId('medley-selection-count')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
    expect(within(dialog).getAllByTestId('medley-song-card')).toHaveLength(1);
    expect(within(dialog).getAllByTestId('medley-song-card')[0]).toHaveAttribute('data-song-id','B');
  });

  it('clears only the requested song from A-B-A and preserves B for subsequent additions', () => {
    const onChange = vi.fn<(medleys: ScaleMedley[]) => void>();
    render(<MedleyStudioV2 songs={[song('A','Am F'), song('B','C G'), song('C','Dm G')]} medleys={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    const row = (id: string) => within(dialog).getAllByTestId('medley-picker-song').find(item => item.getAttribute('data-song-id') === id)!;
    for (const id of ['A','B']) fireEvent.click(within(row(id)).getByRole('button', { name: new RegExp(id + '.*Am') }));
    fireEvent.click(within(row('A')).getByRole('button', { name: 'medleyStudioV2.addSongAgain' }));
    fireEvent.click(within(row('A')).getByRole('button', { name: 'medleyStudioV2.clearSong A' }));
    expect(within(row('A')).queryByTestId('medley-selection-count')).not.toBeInTheDocument();
    expect(within(row('B')).getByText('#1')).toBeInTheDocument();
    fireEvent.click(within(row('C')).getByRole('button', { name: /C.*Am/ }));
    continueToReview(dialog, 1);
    fireEvent.click(within(dialog).getByText('medley.use'));
    expect(onChange.mock.calls[0][0][0].steps.map(step => step.songId)).toEqual(['B','C']);
  });

  it('keeps unmarked charts available for manually choosing lines', () => {
    render(<MedleyStudioV2 songs={[song('A', 'Am F\\nPalavra'), song('B', 'G C')]} medleys={[]} onChange={vi.fn()} initialSongIds={['A','B']} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('medleyStudioV2.manualSectionHint')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('medley.from')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('medley.to')).toBeInTheDocument();
  });
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
    expect(within(dialog).getByText('medleyStudioV2.next')).toBeDisabled();
    expect(within(dialog).queryByText('medley.use')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /A.*Am/ }));
    expect(within(dialog).getByText('1 / 30 medley.excerpt')).toBeInTheDocument();
    expect(within(dialog).queryByText('medley.use')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /B.*Am/ }));
    continueToReview(dialog, 1);
    expect(within(dialog).getByTestId('medley-studio-review')).toBeInTheDocument();
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
    continueToReview(dialog, 2);
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
    fireEvent.click(within(dialog).getByText('medleyStudioV2.addMusic'));
    fireEvent.click(within(dialog).getByText('B'));
    fireEvent.change(within(dialog).getByLabelText('medley.templateName'), { target: { value: 'Adoração em sequência' } });
    continueToReview(dialog, 1);
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
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
    fireEvent.click(within(dialog).getAllByText('medleyStudioV2.useAsCue')[0]);
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
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
    continueToReview(screen.getByRole('dialog'), 2);
    fireEvent.click(within(screen.getByRole('dialog')).getByText('medley.use'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('medley.reviewRequired');
  });
});
