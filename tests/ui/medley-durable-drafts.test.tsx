import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PopulatedSong } from '../../types';
import { MedleyStudioV2 } from '../../components/scales/MedleyStudioV2';

const memory = vi.hoisted(() => ({
  drafts: new Map<string, any>(),
  organization: 'org-a',
  writes: 0,
  failWrites: false,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-a' }, effectiveOrganizationId: memory.organization }),
}));
vi.mock('../../services/offline/medleyStudioDraftStore', () => ({
  MedleyDraftConflictError: class extends Error {},
  medleyDraftStorageKey: (identity: any, id: string) =>
    [identity.userId, identity.organizationId, identity.scope, id].join(':'),
  saveDurableMedleyDraft: vi.fn(async (identity: any, id: string, editor: any, expectedRevision: number) => {
    if (memory.failWrites) throw new Error('simulated offline storage failure');
    const key = [identity.userId, identity.organizationId, identity.scope, id].join(':');
    const previous = memory.drafts.get(key);
    if ((previous?.revision || 0) !== expectedRevision) throw new Error('revision conflict');
    const next = { ...identity, ...editor, id, key, revision: expectedRevision + 1, updatedAt: Date.now() };
    memory.writes += 1;
    memory.drafts.set(key, next);
    return next;
  }),
  listDurableMedleyDrafts: vi.fn(async (identity: any) =>
    [...memory.drafts.values()].filter(d => d.userId === identity.userId && d.organizationId === identity.organizationId && d.scope === identity.scope)),
  deleteDurableMedleyDraft: vi.fn(async (identity: any, id: string) =>
    void memory.drafts.delete([identity.userId, identity.organizationId, identity.scope, id].join(':'))),
}));

const song = (id: string): PopulatedSong => ({
  id, title: id, artist: '', organizationId: 'org-a', key: 'Am', bpm: 80,
  chords: 'Am F\nC G', lyrics: '', tabs: [], chordsUrl: '', videoUrl: '',
  status: 'active', tagIds: [], createdAt: '', lastPlayed: null,
  createdBy: { uid: 'user-a' } as PopulatedSong['createdBy'], tags: [],
});
const songs = [song('A'), song('B')];
beforeEach(() => {
  memory.drafts.clear();
  memory.organization = 'org-a';
  memory.writes = 0;
  memory.failWrites = false;
  sessionStorage.clear();
});

describe('Medley Studio durable recovery UI', () => {
  it('autosaves edited passages and restores them after the editor is unmounted', async () => {
    const ui = () => <MedleyStudioV2 songs={songs} medleys={[]} initialSongIds={['A', 'B']} onChange={vi.fn()} />;
    const first = render(ui());
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'medleyStudioV2.duplicate' })[0]);
    expect(within(dialog).getByText('3 / 30 medley.excerpt')).toBeInTheDocument();
    await waitFor(() => expect(memory.writes).toBeGreaterThan(0), { timeout: 2500 });
    expect(screen.queryByTestId('medley-drafts-list')).not.toBeInTheDocument();
    expect(screen.queryByText('medleyStudioV2.localOnly')).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('medley-save-toast')).toHaveTextContent('medleyStudioV2.draftStatus_saved');
    await waitFor(() => expect(screen.queryByTestId('medley-save-toast')).not.toBeInTheDocument(), { timeout: 3000 });
    first.unmount();

    render(ui());
    fireEvent.click(screen.getByText('medley.create'));
    const reopened = screen.getByRole('dialog');
    const recovery = await screen.findByRole('alertdialog', { name: 'medleyStudioV2.resumeTitle' });
    expect(screen.queryByTestId('medley-drafts-list')).not.toBeInTheDocument();
    fireEvent.click(within(recovery).getByRole('button', { name: 'medleyStudioV2.continueDraft' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(within(reopened).getByText('3 / 30 medley.excerpt')).toBeInTheDocument();
  });

  it('blocks closing unsaved edits when local storage rejects the write', async () => {
    memory.failWrites = true;
    render(<MedleyStudioV2 songs={songs} medleys={[]} initialSongIds={['A', 'B']} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('medley.create'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'medleyStudioV2.duplicate' })[0]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'medley.close' }));
    await waitFor(() => expect(within(dialog).getByTestId('medley-draft-error')).toHaveTextContent('medleyStudioV2.draftStatus_failed'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    memory.failWrites = false;
    fireEvent.click(within(dialog).getByRole('button', { name: 'medleyStudioV2.retryDraft' }));
    await waitFor(() => expect(memory.writes).toBeGreaterThan(0));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not display organization A drafts when B is active', async () => {
    memory.drafts.set('user-a:org-a:repertoire:draft-1', {
      id: 'draft-1', key: 'user-a:org-a:repertoire:draft-1',
      userId: 'user-a', organizationId: 'org-a', scope: 'repertoire',
      name: 'Private A', revision: 1, updatedAt: 1, editingId: null,
      stage: 1, activeId: null, blocks: [],
    });
    memory.organization = 'org-b';
    render(<MedleyStudioV2 songs={songs} medleys={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('medley.create'));
    await waitFor(() => expect(screen.queryByText('Private A')).not.toBeInTheDocument());
    expect(screen.queryByTestId('medley-drafts-list')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('offers recovery only when returning to unfinished work, and starting fresh keeps the old draft', async () => {
    memory.drafts.set('user-a:org-a:repertoire:draft-1', {
      id: 'draft-1', key: 'user-a:org-a:repertoire:draft-1',
      userId: 'user-a', organizationId: 'org-a', scope: 'repertoire',
      name: 'Previous arrangement', revision: 1, updatedAt: 100,
      editingId: null, stage: 2, activeId: null, blocks: [],
    });
    render(<MedleyStudioV2 songs={songs} medleys={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('medley.create'));
    const recovery = await screen.findByRole('alertdialog', { name: 'medleyStudioV2.resumeTitle' });
    expect(within(recovery).getByText('Previous arrangement')).toBeInTheDocument();
    fireEvent.click(within(recovery).getByRole('button', { name: 'medleyStudioV2.startNew' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('medley-drafts-list')).not.toBeInTheDocument();
    expect(memory.drafts).toHaveProperty('size', 1);
  });
});
