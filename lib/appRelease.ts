import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'reusable-fixed-band-direct-entry-beta-0.6',
  version: '0.6.0-beta.0',
  publishedAt: '2026-09-20T04:35:00Z',
  translationKey: 'releaseNews.reusableBandBeta06',
  kind: 'feature' as ReleaseKind,
} as const;
