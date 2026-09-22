import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'fixed-band-formation-workflow-beta-0.7',
  version: '0.7.0-beta.0',
  publishedAt: '2026-09-22T00:00:00Z',
  translationKey: 'releaseNews.fixedBandWorkflowBeta07',
  kind: 'feature' as ReleaseKind,
} as const;
