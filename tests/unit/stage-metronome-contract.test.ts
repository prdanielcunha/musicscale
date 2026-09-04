import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const metronome = fs.readFileSync(
  path.join(process.cwd(), 'components/common/Metronome.tsx'),
  'utf8',
);
const viewer = fs.readFileSync(
  path.join(process.cwd(), 'components/songs/ChordsViewerModal.tsx'),
  'utf8',
);

describe('Stage metronome contract', () => {
  it('keeps the existing AudioContext scheduler while adding stage controls', () => {
    expect(metronome).toContain('AudioContext');
    expect(metronome).toContain('scheduleAheadTime');
    expect(metronome).toContain('handleTapTempo');
    expect(metronome).toContain('beatsPerBar');
    expect(metronome).toContain('subdivision');
    expect(metronome).toContain('volume');
  });

  it('preserves the original play/pause and BPM range behavior', () => {
    expect(metronome).toContain('min="40"');
    expect(metronome).toContain('max="240"');
    expect(metronome).toContain('togglePlay');
  });

  it('adds the metronome to Performance without replacing existing dock controls', () => {
    expect(viewer).toContain('isStageMetronomeOpen');
    expect(viewer).toContain('<Metronome initialBpm={song.bpm || 72}');
    expect(viewer).toContain('setIsAutoScrolling');
    expect(viewer).toContain('data-testid="chords-viewer-transposed-key"');
  });
});
