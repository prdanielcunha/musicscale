import { describe, expect, it } from 'vitest';
import {
  MUSIC_SCALE_PUBLISH_COMMAND_FLAG,
  isMusicScalePublishCommandEnabledForOrganization,
} from '../../utils/musicScalePublishFeature';

describe('MusicScale publish feature compatibility', () => {
  it('enables publish when a legacy organization has no rollout key', () => {
    expect(isMusicScalePublishCommandEnabledForOrganization({ featureFlags: {}, features: {} })).toBe(true);
    expect(isMusicScalePublishCommandEnabledForOrganization({})).toBe(true);
  });

  it('keeps an explicit canonical false as an operational kill switch', () => {
    expect(isMusicScalePublishCommandEnabledForOrganization({
      featureFlags: { [MUSIC_SCALE_PUBLISH_COMMAND_FLAG]: false },
      features: { [MUSIC_SCALE_PUBLISH_COMMAND_FLAG]: true },
    })).toBe(false);
  });

  it('honors canonical true and falls back to the legacy map when needed', () => {
    expect(isMusicScalePublishCommandEnabledForOrganization({
      featureFlags: { [MUSIC_SCALE_PUBLISH_COMMAND_FLAG]: true },
    })).toBe(true);
    expect(isMusicScalePublishCommandEnabledForOrganization({
      features: { [MUSIC_SCALE_PUBLISH_COMMAND_FLAG]: false },
    })).toBe(false);
  });
});
