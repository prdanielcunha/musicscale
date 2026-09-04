import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = fs.readFileSync(
  path.join(process.cwd(), 'hooks/useLiveWorshipSession.ts'),
  'utf8',
);
const viewer = fs.readFileSync(
  path.join(process.cwd(), 'components/songs/ChordsViewerModal.tsx'),
  'utf8',
);
const director = fs.readFileSync(
  path.join(process.cwd(), 'components/songs/LiveWorshipDirector.tsx'),
  'utf8',
);

describe('Live section direction contract', () => {
  it('persists a dedicated section command without replacing existing cue or song controls', () => {
    expect(hook).toContain('const changeSection = async');
    expect(hook).toContain('activeSection: {');
    expect(hook).toContain('changeSong');
    expect(hook).toContain('pushCue');
    expect(hook).toContain('changeKeyOverride');
  });

  it('keeps personal section navigation separate from broadcast direction', () => {
    expect(viewer).toContain('sectionNavigatorItems');
    expect(viewer).toContain('scrollToSectionIndex');
    expect(viewer).toContain('isFollowingDirection');
    expect(director).toContain('handleSectionDirection');
    expect(director).toContain('changeSection(currentSongId');
  });

  it('preserves existing performance controls', () => {
    expect(viewer).toContain('setIsAutoScrolling');
    expect(viewer).toContain('changeKeyOverride');
    expect(viewer).toContain('WakeLock');
    expect(viewer).toContain('<LiveWorshipDirector');
  });
});
