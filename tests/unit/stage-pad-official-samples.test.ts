import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_WARM_PAD_KEYS,
  getOfficialWarmPadAssetUrl,
} from '../../services/officialPadLibrary';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Official Warm pad library', () => {
  it('maps all 12 MusicScale keys to stable same-origin assets', () => {
    expect(OFFICIAL_WARM_PAD_KEYS).toHaveLength(12);
    expect(getOfficialWarmPadAssetUrl('C')).toBe('/assets/pads/warm-v1/C.mp3');
    expect(getOfficialWarmPadAssetUrl('C#')).toBe('/assets/pads/warm-v1/Cs.mp3');
    expect(getOfficialWarmPadAssetUrl('Eb')).toBe('/assets/pads/warm-v1/Eb.mp3');
    expect(getOfficialWarmPadAssetUrl('Ab')).toBe('/assets/pads/warm-v1/Ab.mp3');
    expect(getOfficialWarmPadAssetUrl('Bb')).toBe('/assets/pads/warm-v1/Bb.mp3');
  });

  it('streams the official Warm sample and keeps the synth fallback', () => {
    const engine = read('services/stagePadEngine.ts');
    expect(engine).toContain('createOfficialWarmVoice');
    expect(engine).toContain('createMediaElementSource');
    expect(engine).toContain("preset === 'warm'");
    expect(engine).toContain("this.createSynthVoice(key, 'warm')");
    expect(engine).toContain('audio.loop = true');
  });

  it('ships a checksum manifest for the supplied Warm v1 source package', () => {
    const manifest = JSON.parse(read('public/assets/pads/warm-v1/manifest.json'));
    expect(Object.keys(manifest.keys)).toHaveLength(12);
    expect(manifest.audio.sampleRateHz).toBe(44100);
    expect(manifest.audio.channels).toBe(2);
    expect(manifest.keys.G.sourceFile).toBe('Pad_G_Warm.mp3');
    expect(manifest.keys.Bb.sourceFile).toBe('Pad_A#_Warm.mp3');
  });
});
