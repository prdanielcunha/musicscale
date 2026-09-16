import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({
  start: vi.fn(async (key: string) => key),
  changeKey: vi.fn(async (key: string) => key),
  stop: vi.fn(),
  setVolume: vi.fn(),
  getVolume: vi.fn(() => 0.46),
  isPlaying: vi.fn(() => false),
}));

vi.mock('../../services/stagePadEngine', () => {
  const keys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
  const normalize = (value?: string | null) => {
    const clean = String(value || 'C').trim().replace(/m$/, '');
    const aliases: Record<string, string> = { Db: 'C#', 'D#': 'Eb', Gb: 'F#', 'G#': 'Ab', 'A#': 'Bb' };
    return aliases[clean] || clean || 'C';
  };
  const display = (value?: string | null) => {
    const match = String(value || 'C').trim().match(/^([A-Ga-g](?:#|b)?)(m(?!aj))?/);
    if (!match) return normalize(value);
    return `${match[1][0].toUpperCase()}${match[1].slice(1)}${match[2] ? 'm' : ''}`;
  };
  return {
    STAGE_PAD_KEYS: keys,
    normalizePadKey: normalize,
    formatPadDisplayKey: display,
    stagePadEngine: engine,
  };
});

import StagePadPlayer from '../../components/songs/StagePadPlayer';
import { STAGE_PAD_DEVICE_OUTPUT_STORAGE_KEY } from '../../services/stagePadDevicePreference';

describe('StagePadPlayer device output', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    engine.getVolume.mockReturnValue(0.46);
    engine.isPlaying.mockReturnValue(false);
  });

  it('works standalone without songKey and does not offer a fake return to conduction', () => {
    const { getByTestId, queryByText } = render(<StagePadPlayer />);
    expect(getByTestId('stage-pad-control-mode')).toHaveTextContent('pad.individual_control');
    expect(getByTestId('stage-pad-display-key')).toHaveTextContent('C');
    expect(queryByText('pad.return_to_conduction')).not.toBeInTheDocument();
  });

  it('prevents engine start while output is disabled', () => {
    const { getByTestId } = render(<StagePadPlayer />);
    const output = getByTestId('stage-pad-device-output');
    fireEvent.click(output);
    expect(output).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(getByTestId('stage-pad-play'));
    expect(engine.start).not.toHaveBeenCalled();
    expect(localStorage.getItem(STAGE_PAD_DEVICE_OUTPUT_STORAGE_KEY)).toBe('disabled');
  });

  it('fades out immediately when this device is disabled during playback', async () => {
    const { getByTestId } = render(<StagePadPlayer />);
    fireEvent.click(getByTestId('stage-pad-play'));
    await waitFor(() => expect(engine.start).toHaveBeenCalledWith('C'));

    fireEvent.click(getByTestId('stage-pad-device-output'));
    expect(engine.stop).toHaveBeenCalledWith(0.35);
    expect(getByTestId('stage-pad-device-status')).toHaveTextContent('pad.device_disabled');
  });

  it('persists the preference only in the current browser storage', () => {
    const first = render(<StagePadPlayer />);
    fireEvent.click(first.getByTestId('stage-pad-device-output'));
    first.unmount();

    const second = render(<StagePadPlayer />);
    expect(second.getByTestId('stage-pad-device-output')).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem(STAGE_PAD_DEVICE_OUTPUT_STORAGE_KEY)).toBe('disabled');
  });

  it('presents Am as Am while the neutral engine receives root A', async () => {
    const { getByTestId } = render(<StagePadPlayer songKey="Am" />);
    expect(getByTestId('stage-pad-display-key')).toHaveTextContent('Am');
    expect(getByTestId('stage-pad-control-mode')).toHaveTextContent('pad.follow_conduction');

    fireEvent.click(getByTestId('stage-pad-play'));
    await waitFor(() => expect(engine.start).toHaveBeenCalledWith('A'));
    expect(getByTestId('stage-pad-display-key')).toHaveTextContent('Am');
  });
});
