import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PopulatedSong } from '../../types';
import { MedleyStudioV2 } from '../../components/scales/MedleyStudioV2';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, effectiveOrganizationId: 'org-1' }) }));

const song = (id: string): PopulatedSong => ({
  id, organizationId: 'org-1', title: id, artist: '', key: 'G', status: 'active', tagIds: [],
  chords: 'G C\nDeus é bom', lyrics: '', tabs: [],
  chordsUrl: '', videoUrl: '', createdAt: '', lastPlayed: null,
  createdBy: { uid: 'u1' } as PopulatedSong['createdBy'], tags: [],
});

describe('medley save progress', () => {
  it('displays the callback progress, locks repeated saves and keeps the draft while writing', async () => {
    sessionStorage.clear();
    let finish!: () => void;
    const onSaveTemplate = vi.fn(async (_medley: unknown, _name: string, report?: (message: string) => void) => {
      report?.('Salvando cifra e letra…');
      await new Promise<void>(resolve => { finish = resolve; });
    });
    render(
      <MedleyStudioV2
        songs={[song('A'), song('B')]}
        medleys={[]}
        onChange={vi.fn()}
        onSaveTemplate={onSaveTemplate}
        launchImmediately
        templateOnly
        initialSongIds={['A', 'B']}
      />,
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
    fireEvent.click(within(dialog).getByText('medleyStudioV2.next'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'medleyStudioV2.saveAsSong' }));
    const progress = await within(dialog).findByTestId('medley-save-progress');
    expect(progress).toHaveTextContent('Salvando cifra e letra…');
    expect(within(dialog).getByRole('button', { name: 'medleyStudioV2.saveAsSong' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'medley.cancel' })).toBeDisabled();
    expect(onSaveTemplate).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
