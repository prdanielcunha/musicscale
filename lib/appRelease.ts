import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'stage-tools-v2-offline-beta-0.3',
  version: '0.3.0-beta.0',
  publishedAt: '2026-09-17T10:00:00Z',
  translationKey: 'releaseNews.stageToolsBeta03',
  kind: 'feature' as ReleaseKind,
} as const;
