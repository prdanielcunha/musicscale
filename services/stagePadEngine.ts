import type { CustomPadAssetRow } from './offline/database';

const NOTE_FREQUENCIES: Record<string, number> = {
  C: 130.8128,
  'C#': 138.5913,
  Db: 138.5913,
  D: 146.8324,
  'D#': 155.5635,
  Eb: 155.5635,
  E: 164.8138,
  F: 174.6141,
  'F#': 184.9972,
  Gb: 184.9972,
  G: 195.9977,
  'G#': 207.6523,
  Ab: 207.6523,
  A: 220,
  'A#': 233.0819,
  Bb: 233.0819,
  B: 246.9417,
};

export const STAGE_PAD_KEYS = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

export type StagePadKey = (typeof STAGE_PAD_KEYS)[number];
export const STAGE_PAD_PRESETS = ['worship', 'warm', 'air', 'deep', 'custom'] as const;
export type StagePadPreset = (typeof STAGE_PAD_PRESETS)[number];

export const normalizePadKey = (value?: string | null): StagePadKey => {
  const clean = String(value || 'C')
    .trim()
    .replace(/m$/, '')
    .replace(/sus.*$/i, '')
    .replace(/add.*$/i, '');
  const aliases: Record<string, StagePadKey> = {
    Db: 'C#',
    'D#': 'Eb',
    Gb: 'F#',
    'G#': 'Ab',
    'A#': 'Bb',
  };
  const normalized = aliases[clean] || clean;
  return (STAGE_PAD_KEYS as readonly string[]).includes(normalized)
    ? (normalized as StagePadKey)
    : 'C';
};

export const formatPadDisplayKey = (value?: string | null): string => {
  const clean = String(value || 'C').trim();
  const match = clean.match(/^([A-Ga-g](?:#|b)?)(m(?!aj))?/);
  if (!match) return normalizePadKey(value);
  const root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return `${root}${match[2] ? 'm' : ''}`;
};

interface PadPresetConfig {
  filterFrequency: number;
  q: number;
  dry: number;
  delayTime: number;
  feedback: number;
  wet: number;
  attack: number;
  release: number;
  ratios: number[];
  detunes: number[];
  types: OscillatorType[];
  levels: number[];
  chorusRate: number;
  chorusDepth: number;
}

const PRESET_CONFIG: Record<Exclude<StagePadPreset, 'custom'>, PadPresetConfig> = {
  worship: {
    filterFrequency: 1550,
    q: 0.42,
    dry: 0.64,
    delayTime: 0.69,
    feedback: 0.42,
    wet: 0.29,
    attack: 1.65,
    release: 1.5,
    ratios: [0.5, 1, 1, 1.5, 2, 3],
    detunes: [-8, -7, 7, 3, -4, 6],
    types: ['sine', 'triangle', 'sine', 'sine', 'triangle', 'sine'],
    levels: [0.22, 0.23, 0.2, 0.13, 0.1, 0.045],
    chorusRate: 0.075,
    chorusDepth: 5.5,
  },
  warm: {
    filterFrequency: 1050,
    q: 0.5,
    dry: 0.76,
    delayTime: 0.58,
    feedback: 0.31,
    wet: 0.2,
    attack: 1.35,
    release: 1.25,
    ratios: [0.5, 1, 1, 2],
    detunes: [-4, -5, 5, 1],
    types: ['sine', 'triangle', 'sine', 'triangle'],
    levels: [0.26, 0.28, 0.25, 0.1],
    chorusRate: 0.055,
    chorusDepth: 3.2,
  },
  air: {
    filterFrequency: 2550,
    q: 0.32,
    dry: 0.55,
    delayTime: 0.82,
    feedback: 0.47,
    wet: 0.35,
    attack: 1.9,
    release: 1.7,
    ratios: [0.5, 1, 1.5, 2, 2.5, 4],
    detunes: [-5, 0, 4, -7, 8, -2],
    types: ['sine', 'sine', 'triangle', 'sine', 'sine', 'triangle'],
    levels: [0.16, 0.25, 0.13, 0.11, 0.06, 0.028],
    chorusRate: 0.09,
    chorusDepth: 7,
  },
  deep: {
    filterFrequency: 780,
    q: 0.62,
    dry: 0.79,
    delayTime: 0.64,
    feedback: 0.3,
    wet: 0.18,
    attack: 1.5,
    release: 1.6,
    ratios: [0.25, 0.5, 1, 1, 1.5],
    detunes: [0, -3, -4, 4, 1],
    types: ['sine', 'sine', 'triangle', 'sine', 'sine'],
    levels: [0.08, 0.27, 0.28, 0.22, 0.08],
    chorusRate: 0.045,
    chorusDepth: 2.5,
  },
};

interface Voice {
  sources: AudioScheduledSourceNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  dryGain: GainNode;
  delayGain: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  release: number;
}

const KEY_INDEX: Record<StagePadKey, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
};

class StagePadEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private activeVoice: Voice | null = null;
  private activeKey: StagePadKey | null = null;
  private activePreset: StagePadPreset | null = null;
  private targetVolume = 0.46;
  private decodedCustomBuffer: { signature: string; buffer: AudioBuffer } | null = null;

  private getContext() {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextConstructor) throw new Error('WEB_AUDIO_UNAVAILABLE');
      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      this.master.gain.value = this.targetVolume;
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 8;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.22;
      this.master.connect(limiter);
      limiter.connect(this.context.destination);
    }
    return this.context;
  }

  private createSignalPath(config: Pick<PadPresetConfig, 'filterFrequency' | 'q' | 'dry' | 'delayTime' | 'feedback' | 'wet'>) {
    const context = this.getContext();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const dryGain = context.createGain();
    const delay = context.createDelay(2.5);
    const feedback = context.createGain();
    const delayGain = context.createGain();

    gain.gain.value = 0.0001;
    filter.type = 'lowpass';
    filter.frequency.value = config.filterFrequency;
    filter.Q.value = config.q;
    dryGain.gain.value = config.dry;
    delay.delayTime.value = config.delayTime;
    feedback.gain.value = config.feedback;
    delayGain.gain.value = config.wet;

    gain.connect(filter);
    filter.connect(dryGain);
    dryGain.connect(this.master!);
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(this.master!);

    return { gain, filter, dryGain, delay, feedback, delayGain };
  }

  private createSynthVoice(key: StagePadKey, preset: Exclude<StagePadPreset, 'custom'>): Voice {
    const context = this.getContext();
    const config = PRESET_CONFIG[preset];
    const rootFrequency = NOTE_FREQUENCIES[key] || NOTE_FREQUENCIES.C;
    const path = this.createSignalPath(config);
    const sources: AudioScheduledSourceNode[] = [];

    const chorus = context.createOscillator();
    const chorusDepth = context.createGain();
    chorus.type = 'sine';
    chorus.frequency.value = config.chorusRate;
    chorusDepth.gain.value = config.chorusDepth;
    chorus.connect(chorusDepth);
    chorus.start();
    sources.push(chorus);

    config.ratios.forEach((ratio, index) => {
      const oscillator = context.createOscillator();
      const oscillatorGain = context.createGain();
      oscillator.type = config.types[index] || 'sine';
      oscillator.frequency.value = rootFrequency * ratio;
      oscillator.detune.value = config.detunes[index] || 0;
      oscillatorGain.gain.value = config.levels[index] || 0.05;
      chorusDepth.connect(oscillator.detune);
      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(path.gain);
      oscillator.start();
      sources.push(oscillator);
    });

    return { ...path, sources, release: config.release };
  }

  private async decodeCustomAsset(asset: CustomPadAssetRow) {
    const context = this.getContext();
    const signature = `${asset.id}:${asset.updatedAt}:${asset.size}`;
    if (this.decodedCustomBuffer?.signature === signature) return this.decodedCustomBuffer.buffer;
    const arrayBuffer = await asset.blob.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
    this.decodedCustomBuffer = { signature, buffer };
    return buffer;
  }

  private async createCustomVoice(key: StagePadKey, asset: CustomPadAssetRow): Promise<Voice> {
    const context = this.getContext();
    const buffer = await this.decodeCustomAsset(asset);
    const path = this.createSignalPath({
      filterFrequency: 5200,
      q: 0.25,
      dry: 0.9,
      delayTime: 0.7,
      feedback: 0.22,
      wet: 0.12,
    });
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.max(0.05, buffer.duration);

    const baseKey = normalizePadKey(asset.baseKey);
    const rawDelta = KEY_INDEX[key] - KEY_INDEX[baseKey];
    const semitoneDelta = ((rawDelta + 18) % 12) - 6;
    source.playbackRate.value = Math.pow(2, semitoneDelta / 12);
    source.connect(path.gain);
    source.start();

    return { ...path, sources: [source], release: 1.25 };
  }

  private disposeVoice(voice: Voice, afterSeconds = 0) {
    const context = this.context;
    if (!context) return;
    const stopAt = context.currentTime + Math.max(0.02, afterSeconds);
    voice.sources.forEach((source) => {
      try {
        source.stop(stopAt);
      } catch {
        // Already stopped.
      }
    });
  }

  async start(
    keyInput?: string | null,
    preset: StagePadPreset = 'worship',
    customAsset?: CustomPadAssetRow | null,
  ) {
    const context = this.getContext();
    // iOS/WebKit requires resume to happen directly in the user gesture before
    // any asynchronous sample decoding work.
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') throw new Error('PAD_AUDIO_CONTEXT_BLOCKED');

    const key = normalizePadKey(keyInput);
    if (this.activeVoice && this.activeKey === key && this.activePreset === preset) return key;

    if (preset === 'custom' && !customAsset) throw new Error('CUSTOM_PAD_MISSING');
    const nextVoice = preset === 'custom'
      ? await this.createCustomVoice(key, customAsset!)
      : this.createSynthVoice(key, preset);

    const attack = preset === 'custom' ? 0.7 : PRESET_CONFIG[preset].attack;
    const now = context.currentTime;
    nextVoice.gain.gain.cancelScheduledValues(now);
    nextVoice.gain.gain.setValueAtTime(0.0001, now);
    nextVoice.gain.gain.exponentialRampToValueAtTime(0.82, now + attack);

    const previous = this.activeVoice;
    if (previous) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(Math.max(0.0001, previous.gain.gain.value), now);
      previous.gain.gain.exponentialRampToValueAtTime(0.0001, now + previous.release);
      this.disposeVoice(previous, previous.release + 0.1);
    }

    this.activeVoice = nextVoice;
    this.activeKey = key;
    this.activePreset = preset;
    return key;
  }

  async changeKey(
    keyInput: string,
    preset: StagePadPreset = this.activePreset || 'worship',
    customAsset?: CustomPadAssetRow | null,
  ) {
    return this.start(keyInput, preset, customAsset);
  }

  stop(fadeSeconds?: number) {
    const context = this.context;
    const voice = this.activeVoice;
    if (!context || !voice) {
      this.activeVoice = null;
      this.activeKey = null;
      this.activePreset = null;
      return;
    }

    const release = fadeSeconds ?? voice.release;
    const now = context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.08, release));
    this.disposeVoice(voice, Math.max(0.1, release) + 0.08);
    this.activeVoice = null;
    this.activeKey = null;
    this.activePreset = null;
  }

  setVolume(value: number) {
    this.targetVolume = Math.max(0, Math.min(1, value));
    if (!this.master || !this.context) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.targetVolume, now, 0.025);
  }

  getVolume() {
    return this.targetVolume;
  }

  getActiveKey() {
    return this.activeKey;
  }

  getActivePreset() {
    return this.activePreset;
  }

  isPlaying() {
    return !!this.activeVoice;
  }
}

export const stagePadEngine = new StagePadEngine();
