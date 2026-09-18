import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'personal-preparation-safe-duplicates-beta-0.5',
  version: '0.5.0-beta.0',
  publishedAt: '2026-09-18T17:45:00Z',
  translationKey: 'releaseNews.personalPreparationBeta05',
  kind: 'feature' as ReleaseKind,
} as const;
