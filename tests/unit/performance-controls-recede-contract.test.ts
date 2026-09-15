import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const viewer = fs.readFileSync(
  path.join(process.cwd(), 'components/songs/ChordsViewerModal.tsx'),
  'utf8',
);

describe('Performance controls recede contract', () => {
  it('keeps an explicit idle timeout and interaction reset path', () => {
    expect(viewer).toContain('PERFORMANCE_CONTROLS_IDLE_MS = 3200');
    expect(viewer).toContain('const markControlsActivity = useCallback');
    expect(viewer).toContain('setControlsActivityTick((current) => current + 1)');
    expect(viewer).toContain('window.setTimeout(() =>');
    expect(viewer).toContain('setIsUIVisible(false)');
  });

  it('does not hide controls while a musician is actively using stage tools', () => {
    expect(viewer).toContain('isEditing ||');
    expect(viewer).toContain('isWorshipFlow ||');
    expect(viewer).toContain('isAutoScrolling ||');
    expect(viewer).toContain('activeTab !== "none" ||');
    expect(viewer).toContain('isStageMetronomeOpen ||');
    expect(viewer).toContain('isStagePadOpen');
  });

  it('resets the idle window from the stage chrome without changing audio controls', () => {
    expect(viewer.match(/onPointerDown=\{markControlsActivity\}/g)?.length).toBeGreaterThanOrEqual(2);
    expect(viewer).toContain('import Metronome from "../common/Metronome"');
    expect(viewer).toContain('import StagePadPlayer from "./StagePadPlayer"');
  });
});
