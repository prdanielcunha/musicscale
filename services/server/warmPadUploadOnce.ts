import crypto from 'node:crypto';

export const WARM_PAD_STORAGE_BUCKET = 'millionsnest.firebasestorage.app';
export const WARM_PAD_STORAGE_PREFIX = 'musicscale/pads/official/warm-v1';

export type WarmPadUploadSpec = {
  key: string;
  fileName: string;
  sha256: string;
  objectPath: string;
};

const RAW_SPECS: Array<[string, string, string]> = [
  ['C', 'Pad_C_Warm.mp3', '0312b26b467cbfbcbd7bc5e8ebcf9a90f4e977b10688839e2a2a8ef4a224173c'],
  ['Cs', 'Pad_C#_Warm.mp3', 'f8f1b19873635a9a84a126d5ccb16841b0c97e17e784e18313d32e26ce2a8dfd'],
  ['D', 'Pad_D_Warm.mp3', '3f87621e4f70a05e40c5e56eb6b9d93fcd8ea6ce8ec1081ec58f883c9bf49673'],
  ['Ds', 'Pad_D#_Warm.mp3', '1aec1c3dc0efc5a3c09851cac6495b753aba63080035a97daa43246791eee403'],
  ['E', 'Pad_E_Warm.mp3', '3ed6187d8e6f5fc0b8ca1f094d4afc4fc691ec03746ab7c0febecea8d5a5e1fe'],
  ['F', 'Pad_F_Warm.mp3', 'b7b0ac5e6ee41f108113cdc0d424a0e1dff2919a7e5a79297fa2b0be0d1d01e0'],
  ['Fs', 'Pad_F#_Warm.mp3', '97ef632ae1028b8a526cbe9f0cf80ff06325a597765d2745771239181c0b1278'],
  ['G', 'Pad_G_Warm.mp3', '6edbb967f9d7b949f43fe6a8bc62639833a27833e1cb64a5cb44ed9b5d6c741b'],
  ['Gs', 'Pad_G#_Warm.mp3', '285a3a31e9c5cfa55598add7cfc460645722a3f16853d882ae88325e2c46cd3c'],
  ['A', 'Pad_A_Warm.mp3', 'ebffdefb14fe5be840efc2237a96681cb79ba595de519531c00d8b0cda368255'],
  ['As', 'Pad_A#_Warm.mp3', '8686296cdb38c7a139d60a3989779e80eb37bb6db282ab559cea60cd83ca5d97'],
  ['B', 'Pad_B_Warm.mp3', 'bb64f1199fde3b9bcf224552fa0ba0938ce4be0c297e8eef7d2e05e650ef2de8'],
];

export const WARM_PAD_UPLOAD_SPECS: Readonly<Record<string, WarmPadUploadSpec>> = Object.freeze(
  Object.fromEntries(
    RAW_SPECS.map(([key, fileName, sha256]) => [
      key,
      Object.freeze({
        key,
        fileName,
        sha256,
        objectPath: `${WARM_PAD_STORAGE_PREFIX}/${fileName}`,
      }),
    ]),
  ),
);

export const resolveWarmPadUploadSpec = (key: string | undefined): WarmPadUploadSpec | null => {
  if (!key) return null;
  return WARM_PAD_UPLOAD_SPECS[key] ?? null;
};

export const sha256Buffer = (value: Buffer): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const isWarmPadUploadOnceEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.MUSICSCALE_WARM_PADS_UPLOAD_ONCE_ENABLED === 'true';
