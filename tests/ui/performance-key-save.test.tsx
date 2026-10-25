import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const fixture = vi.hoisted(() => ({
  save: vi.fn(), refresh: vi.fn(), toast: vi.fn(), permissions: {} as any, profile: { uid: 'u1' },
  song: { id: 's1', organizationId: 'org1', title: 'Test chart', artist: 'Artist', key: 'G', selectedKey: 'G', originalKey: 'G', chords: '[Intro] G D Em C\nA tua presença\nE eu te amo', tags: [] },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, userProfile: fixture.profile, effectiveOrganizationId: 'org1', permissions: fixture.permissions }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('../../contexts/MusicDataContext', () => ({ useMusic: () => ({ songs: [fixture.song], scales: [{ id: 'scale1', songSettings: {} }], refreshData: fixture.refresh }) }));
vi.mock('../../contexts/ApiContext', () => ({ useApi: () => ({ savePerformanceSongKey: fixture.save }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModals: () => ({ openPersistedChordKeyRepair: vi.fn() }) }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ toast: fixture.toast }) }));
vi.mock('../../hooks/useLiveWorshipSession', () => ({ useLiveWorshipSession: () => ({ liveSession: null, isLeader: false, changeKeyOverride: vi.fn() }) }));
vi.mock('../../hooks/useLiveDirectionFollow', () => ({ useLiveDirectionFollow: () => ({ isFollowingDirection: false }) }));
vi.mock('../../services/offline/database', () => ({ savePerformanceState: vi.fn(), getPerformanceState: vi.fn().mockResolvedValue(null) }));
vi.mock('../../components/scales/AiContextualSuggestions', () => ({ AiContextualSuggestions: () => null }));
vi.mock('../../components/songs/LiveWorshipDirector', () => ({ LiveWorshipDirector: () => null }));
vi.mock('../../components/songs/ScaleSongNavigation', () => ({ ScaleSongNavigation: () => null, ScaleSongNavigationMobile: () => null }));
vi.mock('../../components/common/Metronome', () => ({ default: () => null }));
vi.mock('../../components/songs/StagePadPlayer', () => ({ default: () => null }));
vi.mock('../../services/chordRepairClient', () => ({ requestChordRepair: vi.fn() }));
import ChordsViewerModal from '../../components/songs/ChordsViewerModal';
function mount() {
  return render(<ChordsViewerModal isOpen onClose={vi.fn()} song={fixture.song as any} onSave={vi.fn()} isSubmitting={false} scaleContext={{ scaleId: 'scale1', currentIndex: 0, songs: [fixture.song as any] }} onNavigate={vi.fn()} />);
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.song.key = 'G'; fixture.song.selectedKey = 'G';
  fixture.permissions = { manageSongs: true, manageScales: true };
  fixture.save.mockResolvedValue(undefined); fixture.refresh.mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
describe('save a changed performance key', () => {
  it('appears only after transposing; offers both scopes and persists only the chosen scope', async () => {
    mount();
    expect(screen.queryByText('premiumV2.performance.saveKey')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('technicalParts.transpose_up'));
    expect(screen.getByTestId('chords-viewer-transposed-key')).toHaveTextContent('G#');
    expect(screen.getByText('A tua presença')).toBeInTheDocument();
    expect(screen.getByText('E eu te amo')).toBeInTheDocument();
    fireEvent.click(screen.getByText('premiumV2.performance.saveKey'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('premiumV2.performance.saveInRepertoire')).toBeInTheDocument();
    fireEvent.click(screen.getByText('premiumV2.performance.saveInScale'));
    await waitFor(() => expect(fixture.save).toHaveBeenCalledWith(expect.objectContaining({ scope: 'scale', targetKey: 'G#', songId: 's1', scaleId: 'scale1' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('can save again after returning to the original key', async () => {
    mount();
    fireEvent.click(screen.getByLabelText('technicalParts.transpose_up'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveKey'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveInScale'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('technicalParts.transpose_down'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveKey'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveInScale'));
    await waitFor(() => expect(fixture.save).toHaveBeenLastCalledWith(expect.objectContaining({ targetKey: 'G', expectedKey: 'G#' })));
  });
  it('keeps legacy charts readable when the stored key label is unknown', () => {
    fixture.song.key = 'unknown'; fixture.song.selectedKey = 'unknown';
    mount();
    expect(screen.getByText('A tua presença')).toBeInTheDocument();
    expect(screen.getByText('E eu te amo')).toBeInTheDocument();
  });
  it('does not offer a previous song’s backup after navigating to another song', async () => {
    const props = { isOpen: true, onClose: vi.fn(), onSave: vi.fn().mockResolvedValue(undefined), isSubmitting: false, scaleContext: { scaleId: 'scale1', currentIndex: 0, songs: [fixture.song as any] }, onNavigate: vi.fn() };
    const view = render(<ChordsViewerModal {...props} song={fixture.song as any} />);
    fireEvent.click(screen.getByText('premiumV2.performance.edit'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveChart'));
    await waitFor(() => expect(screen.queryByText('premiumV2.performance.saveChart')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Test chart'));
    expect(screen.getByText('premiumV2.performance.restoreOriginal')).toBeInTheDocument();
    view.rerender(<ChordsViewerModal {...props} song={{ ...fixture.song, id: 's2' } as any} />);
    fireEvent.click(screen.getByText('Test chart'));
    expect(screen.getByText('premiumV2.performance.textSize')).toBeInTheDocument();
    expect(screen.queryByText('premiumV2.performance.restoreOriginal')).not.toBeInTheDocument();
  });
  it('keeps the dialog and unsaved change after denied/failed persistence', async () => {
    fixture.save.mockRejectedValue(new Error('permission-denied'));
    mount();
    fireEvent.click(screen.getByLabelText('technicalParts.transpose_up'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveKey'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveInRepertoire'));
    await waitFor(() => expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fixture.refresh).not.toHaveBeenCalled();
  });
  it('offers scale-only saving for a scale editor who cannot edit repertoire', () => {
    fixture.permissions = { manageScales: true };
    mount();
    fireEvent.click(screen.getByLabelText('technicalParts.transpose_up'));
    fireEvent.click(screen.getByText('premiumV2.performance.saveKey'));
    expect(screen.getByText('premiumV2.performance.saveInScale')).toBeInTheDocument();
    expect(screen.queryByText('premiumV2.performance.saveInRepertoire')).not.toBeInTheDocument();
  });
});
