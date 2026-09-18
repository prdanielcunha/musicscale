import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'intelligent-parts-focus-performance-beta-0.4',
  version: '0.4.0-beta.0',
  publishedAt: '2026-09-18T15:00:00Z',
  translationKey: 'releaseNews.intelligentPartsBeta04',
  kind: 'feature' as ReleaseKind,
} as const;
