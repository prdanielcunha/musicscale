import { describe, expect, it } from 'vitest';
import { routeGroupForCapability } from '../src/routing';

describe('provider-neutral capability routing', () => {
  it('routes presentation and preview through one presentation provider', () => {
    expect(routeGroupForCapability('presentation.navigation')).toBe('presentation');
    expect(routeGroupForCapability('preview.snapshot')).toBe('presentation');
  });

  it('keeps songs, Bible and visuals independently routable', () => {
    expect(routeGroupForCapability('songs.present')).toBe('songs');
    expect(routeGroupForCapability('bible.present')).toBe('bible');
    expect(routeGroupForCapability('visual.clip.trigger')).toBe('visual');
  });
});
