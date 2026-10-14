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

  it('keeps the current autoscroll running immediately after a live section jump', () => {
    const scrollHandler = viewer.split('const scrollToSectionIndex = useCallback(')[1]
      ?.split('const lastHandledLiveSectionCommandRef')[0] ?? '';
    const liveDirectionEffect = viewer.split('const lastHandledLiveSectionCommandRef')[1]
      ?.split('const [isFixingChords')[0] ?? '';

    expect(scrollHandler).toContain('preserveAutoScroll = false');
    expect(scrollHandler).toContain('if (preserveAutoScroll) {');
    expect(scrollHandler).toContain('container.scrollTop = targetTop;');
    expect(scrollHandler).toContain('scrollPosRef.current = container.scrollTop;');
    expect(scrollHandler).toContain('lastTimeRef.current = undefined;');
    expect(scrollHandler).toContain('} else {\n      setIsAutoScrolling(false);');
    expect(scrollHandler.split('} else {')[0]).not.toContain('setIsAutoScrolling(');
    expect(liveDirectionEffect.match(/scrollToSectionIndex\(target\.sectionIndex, true\)/g))
      .toHaveLength(2);
    expect(liveDirectionEffect).not.toContain('setIsAutoScrolling(');
    expect(viewer).toContain('const [speedLevel, setSpeedLevel] = useState(3);');
  });

  it('preserves existing performance controls', () => {
    expect(viewer).toContain('setIsAutoScrolling');
    expect(viewer).toContain('changeKeyOverride');
    expect(viewer).toContain('WakeLock');
    expect(viewer).toContain('<LiveWorshipDirector');
  });
});
