import { version } from '../package.json';

export const APP_VERSION = version;

export type ReleaseKind = 'feature' | 'hotfix' | 'visual';

export type ReleaseAction =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; href: string };

// Keep this ID stable across hotfixes and visual revisions. Only a meaningful
// feature release receives a new announcement ID and may auto-present.
export const FEATURE_RELEASE = {
  id: 'nesttuner-beta-0.10',
  version: '0.10.0-beta.0',
  publishedAt: '2026-10-04T00:00:00Z',
  translationKey: 'releaseNews.nestTunerBeta010',
  kind: 'feature' as ReleaseKind,
  actions: {
    stageTools: { kind: 'internal', to: '/stage-tools/tuner' },
    deviceAudio: { kind: 'internal', to: '/stage-tools/tuner' },
    updates: { kind: 'internal', to: '/stage-tools/tuner' },
  } satisfies Record<'stageTools' | 'deviceAudio' | 'updates', ReleaseAction>,
} as const;
