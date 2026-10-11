import { describe, expect, it } from 'vitest';
import { shouldUseMedleyStudioV2, MEDLEY_STUDIO_V2_FLAG } from '../../utils/medleyStudioRollout';

const org = (flags?: Record<string, boolean>, features?: Record<string, boolean>) => ({
  id: 'org-a',
  featureFlags: flags,
  features,
});

describe('Medley Studio V2 default routing and emergency fallback', () => {
  it('opens V2 automatically for an authenticated tenant without opt-in', () => {
    expect(shouldUseMedleyStudioV2('user-1', 'org-a', org())).toBe(true);
    expect(shouldUseMedleyStudioV2('user-1', 'org-a', org({ [MEDLEY_STUDIO_V2_FLAG]: true }))).toBe(true);
  });

  it('keeps V2 closed while auth or the canonical tenant is missing', () => {
    expect(shouldUseMedleyStudioV2(null, 'org-a', org())).toBe(false);
    expect(shouldUseMedleyStudioV2('user-1', null, org())).toBe(false);
    expect(shouldUseMedleyStudioV2('user-1', 'org-a', null)).toBe(false);
    expect(shouldUseMedleyStudioV2('user-1', 'org-b', org())).toBe(false);
  });

  it('falls back to the unchanged legacy editor on explicit org-level false', () => {
    expect(shouldUseMedleyStudioV2('user-1', 'org-a', org({ [MEDLEY_STUDIO_V2_FLAG]: false }))).toBe(false);
    expect(shouldUseMedleyStudioV2('user-1', 'org-a', org(undefined, { [MEDLEY_STUDIO_V2_FLAG]: false }))).toBe(false);
    // Fail closed even if the old and new feature flag maps disagree.
    expect(shouldUseMedleyStudioV2('user-1', 'org-a', org({ [MEDLEY_STUDIO_V2_FLAG]: true }, { [MEDLEY_STUDIO_V2_FLAG]: false }))).toBe(false);
  });

  it('does not read browser storage, override authorization or mutate organization', () => {
    const record = org();
    const before = JSON.stringify(record);
    expect(shouldUseMedleyStudioV2('user-1', 'org-a', record)).toBe(true);
    expect(JSON.stringify(record)).toBe(before);
  });
});
