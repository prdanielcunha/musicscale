export const OFFICIAL_WARM_PAD_ASSET_VERSION = 'v1';

const OFFICIAL_WARM_PAD_FILE_BY_KEY: Record<string, string> = {
  C: 'C.mp3',
  'C#': 'Cs.mp3',
  D: 'D.mp3',
  Eb: 'Eb.mp3',
  E: 'E.mp3',
  F: 'F.mp3',
  'F#': 'Fs.mp3',
  G: 'G.mp3',
  Ab: 'Ab.mp3',
  A: 'A.mp3',
  Bb: 'Bb.mp3',
  B: 'B.mp3',
};

export function getOfficialWarmPadAssetUrl(key: string): string {
  const file = OFFICIAL_WARM_PAD_FILE_BY_KEY[key] || OFFICIAL_WARM_PAD_FILE_BY_KEY.C;
  return `/assets/pads/warm-${OFFICIAL_WARM_PAD_ASSET_VERSION}/${file}`;
}

export const OFFICIAL_WARM_PAD_KEYS = Object.freeze(
  Object.keys(OFFICIAL_WARM_PAD_FILE_BY_KEY),
);
