import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readChordsViewer() {
  return fs.readFileSync(
    path.resolve(process.cwd(), 'components/songs/ChordsViewerModal.tsx'),
    'utf8',
  );
}

describe('P3 stage touch gesture intent contract', () => {
  const source = readChordsViewer();

  it('requires a near-stationary touch before it can become a double-tap candidate', () => {
    expect(source).toContain('const TAP_MOVEMENT_TOLERANCE_PX = 18;');
    expect(source).toContain('const movement = Math.hypot(deltaX, deltaY);');
    expect(source).toContain(
      'const isStationaryTap = movement <= TAP_MOVEMENT_TOLERANCE_PX;',
    );
    expect(source).toMatch(
      /if \(isStationaryTap\) \{[\s\S]*?lastTapRef\.current = now;[\s\S]*?\} else \{[\s\S]*?clearTapCandidate\(\);/,
    );
  });

  it('invalidates tap intent as soon as a gesture becomes multi-touch', () => {
    expect(source).toContain(
      'const touchGestureHadMultiplePointersRef = useRef(false);',
    );
    expect(source).toMatch(
      /else \{[\s\S]*?touchGestureHadMultiplePointersRef\.current = true;[\s\S]*?touchStartXRef\.current = null;[\s\S]*?touchStartYRef\.current = null;[\s\S]*?clearTapCandidate\(\);/,
    );
    expect(source).toMatch(
      /if \(e\.touches\.length > 1\) \{[\s\S]*?touchGestureHadMultiplePointersRef\.current = true;[\s\S]*?clearTapCandidate\(\);/,
    );
  });

  it('requires the second stationary tap to be both timely and spatially close', () => {
    expect(source).toContain('const DOUBLE_TAP_INTERVAL_MS = 300;');
    expect(source).toContain('const DOUBLE_TAP_MAX_DISTANCE_PX = 36;');
    expect(source).toMatch(
      /now - lastTapRef\.current < DOUBLE_TAP_INTERVAL_MS[\s\S]*?previousTapDistance <= DOUBLE_TAP_MAX_DISTANCE_PX/,
    );
    expect(source).toContain('lastTapXRef.current = touchEndX;');
    expect(source).toContain('lastTapYRef.current = touchEndY;');
  });

  it('preserves the existing horizontal swipe navigation contract', () => {
    expect(source).toContain('const swipeThreshold = isWorshipFlow ? 120 : 60;');
    expect(source).toContain('const maxVerticalDrift = 60;');
    expect(source).toContain('onNavigate("previous");');
    expect(source).toContain('onNavigate("next");');
  });
});
