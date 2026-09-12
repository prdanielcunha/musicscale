import { describe, expect, it } from 'vitest';
import {
  MILLIONSNEST_MUSICSCALE_LAUNCH_URL,
  MUSICSCALE_OFFICIAL_ORIGIN,
  isOfficialMusicScaleHost,
  shouldUseMillionsNestDirectEntryBridge,
} from '../../services/ecosystem/directEntry';

describe('MusicScale official-domain direct SSO policy', () => {
  it('keeps the official product origin canonical', () => {
    expect(MUSICSCALE_OFFICIAL_ORIGIN).toBe('https://musicscale.millionsnest.com');
    expect(MILLIONSNEST_MUSICSCALE_LAUNCH_URL).toBe('https://www.millionsnest.com/musicscale/launch');
    expect(MUSICSCALE_OFFICIAL_ORIGIN).not.toContain('.web.app');
  });

  it('bridges unauthenticated /start entry on the official host through MillionsNest', () => {
    expect(shouldUseMillionsNestDirectEntryBridge({
      hostname: 'musicscale.millionsnest.com',
      pathname: '/start',
      hasAuthenticatedUser: false,
    })).toBe(true);
  });

  it('does not redirect an already authenticated local MusicScale session', () => {
    expect(shouldUseMillionsNestDirectEntryBridge({
      hostname: 'musicscale.millionsnest.com',
      pathname: '/start',
      hasAuthenticatedUser: true,
    })).toBe(false);
  });

  it('preserves standalone development and explicit login behavior', () => {
    expect(isOfficialMusicScaleHost('localhost')).toBe(false);
    expect(shouldUseMillionsNestDirectEntryBridge({
      hostname: 'localhost',
      pathname: '/start',
      hasAuthenticatedUser: false,
    })).toBe(false);
    expect(shouldUseMillionsNestDirectEntryBridge({
      hostname: 'musicscale.millionsnest.com',
      pathname: '/login',
      hasAuthenticatedUser: false,
    })).toBe(false);
  });
});
