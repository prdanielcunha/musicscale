import { describe, expect, it } from 'vitest';
import {
  WARM_PAD_STORAGE_BUCKET,
  WARM_PAD_STORAGE_PREFIX,
  WARM_PAD_UPLOAD_SPECS,
  isWarmPadUploadOnceEnabled,
  resolveWarmPadUploadSpec,
  sha256Buffer,
} from '../../services/server/warmPadUploadOnce';

describe('one-time Warm pad upload guard', () => {
  it('locks publication to the 12 official Warm pad objects', () => {
    const specs = Object.values(WARM_PAD_UPLOAD_SPECS);
    expect(specs).toHaveLength(12);
    expect(new Set(specs.map((spec) => spec.objectPath)).size).toBe(12);
    for (const spec of specs) {
      expect(spec.objectPath).toBe(`${WARM_PAD_STORAGE_PREFIX}/${spec.fileName}`);
      expect(spec.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(WARM_PAD_STORAGE_BUCKET).toBe('millionsnest.firebasestorage.app');
  });

  it('rejects unknown keys instead of allowing arbitrary object names', () => {
    expect(resolveWarmPadUploadSpec('C')?.fileName).toBe('Pad_C_Warm.mp3');
    expect(resolveWarmPadUploadSpec('Fs')?.fileName).toBe('Pad_F#_Warm.mp3');
    expect(resolveWarmPadUploadSpec('../../anything')).toBeNull();
    expect(resolveWarmPadUploadSpec('')).toBeNull();
    expect(resolveWarmPadUploadSpec(undefined)).toBeNull();
  });

  it('hashes bytes deterministically for the upload allowlist check', () => {
    expect(sha256Buffer(Buffer.from('musicscale'))).toBe(
      'a56a77f27ae9aa60204979d783519cdcfae4a57ff1bd56bf1183a8a2379db9ef',
    );
  });

  it('is disabled unless the one-time production flag is explicitly true', () => {
    expect(isWarmPadUploadOnceEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isWarmPadUploadOnceEnabled({ MUSICSCALE_WARM_PADS_UPLOAD_ONCE_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isWarmPadUploadOnceEnabled({ MUSICSCALE_WARM_PADS_UPLOAD_ONCE_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
