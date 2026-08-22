import { describe, expect, it } from 'vitest';
import {
  getSafeRecoveryScrollPosition,
  isPerformanceRecoveryStateForContext,
} from '../../utils/performanceRecovery';
import type { PerformanceRecoveryState } from '../../services/offline/database';

const context = {
  organizationId: 'org-A',
  scaleId: 'scale-1',
  songId: 'song-1',
};

function state(overrides: Partial<PerformanceRecoveryState> = {}): PerformanceRecoveryState {
  return {
    id: 'current',
    organizationId: 'org-A',
    scaleId: 'scale-1',
    songId: 'song-1',
    scrollPosition: 480,
    timestamp: 1,
    ...overrides,
  };
}

describe('performance recovery tenant/context scope', () => {
  it('restores only an exact organization, scale and song context', () => {
    const current = state();

    expect(isPerformanceRecoveryStateForContext(current, context)).toBe(true);
    expect(getSafeRecoveryScrollPosition(current, context)).toBe(480);
  });

  it('refuses legacy unscoped recovery records instead of attributing them to the active tenant', () => {
    const legacy = state({ organizationId: undefined });

    expect(isPerformanceRecoveryStateForContext(legacy, context)).toBe(false);
    expect(getSafeRecoveryScrollPosition(legacy, context)).toBe(0);
  });

  it('refuses recovery data from another organization, scale or song', () => {
    expect(isPerformanceRecoveryStateForContext(state({ organizationId: 'org-B' }), context)).toBe(false);
    expect(isPerformanceRecoveryStateForContext(state({ scaleId: 'scale-2' }), context)).toBe(false);
    expect(isPerformanceRecoveryStateForContext(state({ songId: 'song-2' }), context)).toBe(false);
  });

  it('keeps standalone-song recovery distinct from scale-scoped recovery', () => {
    const standaloneContext = { organizationId: 'org-A', songId: 'song-1' };

    expect(isPerformanceRecoveryStateForContext(state({ scaleId: undefined }), standaloneContext)).toBe(true);
    expect(isPerformanceRecoveryStateForContext(state(), standaloneContext)).toBe(false);
  });

  it('never restores malformed, negative or non-finite scroll positions', () => {
    expect(getSafeRecoveryScrollPosition(state({ scrollPosition: -1 }), context)).toBe(0);
    expect(getSafeRecoveryScrollPosition(state({ scrollPosition: Number.NaN }), context)).toBe(0);
    expect(getSafeRecoveryScrollPosition(state({ scrollPosition: Number.POSITIVE_INFINITY }), context)).toBe(0);
    expect(getSafeRecoveryScrollPosition(state({ scrollPosition: 0 }), context)).toBe(0);
  });
});
