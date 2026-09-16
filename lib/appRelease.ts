import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'stage-tools-beta-0.2',
  version: '0.2.0-beta.0',
  publishedAt: '2026-09-16T03:00:00Z',
  translationKey: 'releaseNews.stageToolsBeta02',
  kind: 'feature' as ReleaseKind,
} as const;
