import { describe, it, expect, vi } from 'vitest';
import { resolveAvailableCreateActions } from '../../utils/globalCreateActions';

describe('resolveAvailableCreateActions', () => {
  it('should return empty list when no capabilities', () => {
    const hasCapability = vi.fn().mockReturnValue(false);
    const actions = resolveAvailableCreateActions(hasCapability);
    expect(actions).toHaveLength(0);
  });

  it('should return only song creation when only has musicscale.songs.edit', () => {
    const hasCapability = vi.fn((cap: string) => cap === 'musicscale.songs.edit');
    const actions = resolveAvailableCreateActions(hasCapability);
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('song');
  });

  it('should return both scales when only has musicscale.scales.manage', () => {
    const hasCapability = vi.fn((cap: string) => cap === 'musicscale.scales.manage');
    const actions = resolveAvailableCreateActions(hasCapability);
    expect(actions).toHaveLength(2);
    expect(actions.map(a => a.id)).toEqual(['music-scale', 'band-scale']);
  });

  it('should return all actions when all capabilities are present', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveAvailableCreateActions(hasCapability);
    expect(actions).toHaveLength(3);
    expect(actions.map(a => a.id)).toEqual(['music-scale', 'band-scale', 'song']);
  });

  it('should handle unknown capability requests safely', () => {
    const hasCapability = vi.fn((cap: string) => false);
    const actions = resolveAvailableCreateActions(hasCapability);
    expect(actions).toHaveLength(0);
  });
  
  it('should have deterministic order', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveAvailableCreateActions(hasCapability);
    expect(actions[0].id).toBe('music-scale');
    expect(actions[1].id).toBe('band-scale');
    expect(actions[2].id).toBe('song');
  });
  
  it('should not authorize based on owner isolated (only explicit capability checks)', () => {
    // The resolver should strictly rely on the boolean returned by hasCapability
    const hasCapability = vi.fn((cap: string) => cap === 'musicscale.songs.edit');
    const actions = resolveAvailableCreateActions(hasCapability);
    expect(actions).toHaveLength(1);
    expect(hasCapability).toHaveBeenCalledWith('musicscale.scales.manage');
    expect(hasCapability).toHaveBeenCalledWith('musicscale.songs.edit');
  });
});
