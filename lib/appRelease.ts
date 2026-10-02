import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'canonical-invites-beta-0.9',
  version: '0.9.0-beta.0',
  publishedAt: '2026-10-02T00:00:00Z',
  translationKey: 'releaseNews.canonicalInvitesBeta09',
  kind: 'feature' as ReleaseKind,
} as const;
