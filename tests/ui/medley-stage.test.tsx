import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScaleMedley } from '../../types';
import { MedleyStage } from '../../components/scales/MedleyStage';

const { direct } = vi.hoisted(() => ({ direct: vi.fn(async () => true) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u' }, effectiveOrganizationId: 'org' }) }));
vi.mock('../../hooks/useLiveWorshipSession', () => ({ useLiveWorshipSession: () => ({
  isLive: true, canControlLiveSession: true, liveSession: null, directMedleyStep: direct,
}) }));
vi.mock('../../hooks/useLiveDirectionFollow', () => ({ useLiveDirectionFollow: () => ({
  isFollowingDirection: true, toggleFollowingDirection: vi.fn(), setIsFollowingDirection: vi.fn(),
}) }));
vi.mock('../../components/common/Metronome', () => ({ default: () => <div data-testid="local-click" /> }));
vi.mock('../../components/songs/StagePadPlayer', () => ({ default: () => <div data-testid="local-pad" /> }));

const medley = { id: 'm', anchorSongId: 'a', revision: 1, steps: [
  { id: 'a1', songId: 'a', title: 'A', snapshot: 'G   D', sourceRevision: 'v1', startLine: 0, endLine: 0, repetitions: 2, key: 'G', bpm: 80 },
  { id: 'b1', songId: 'b', title: 'B', snapshot: 'Am   F', sourceRevision: 'v1', startLine: 0, endLine: 0, repetitions: 1, key: 'Am', bpm: 90 },
] } satisfies ScaleMedley;

describe('medley stage', () => {
  it('keeps audio opt-in and stops the local player on an explicit jump', async () => {
    direct.mockClear();
    render(<MedleyStage medley={medley} scaleId="scale" publishRevision={2} />);
    fireEvent.click(screen.getByText('medley.openStage'));
    expect(screen.queryByTestId('local-pad')).toBeNull();
    fireEvent.click(screen.getByText('medley.showPad'));
    expect(screen.getByTestId('local-pad')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2. B' }));
    await waitFor(() => expect(direct).toHaveBeenCalledWith('m', 'b1', 1, 2));
    await waitFor(() => expect(screen.queryByTestId('local-pad')).toBeNull());
    expect(screen.getByRole('dialog').querySelector('pre')?.textContent).toBe('Am   F');
  });
});
