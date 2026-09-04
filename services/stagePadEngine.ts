const NOTE_FREQUENCIES: Record<string, number> = {
  C: 130.8128,
  "C#": 138.5913,
  Db: 138.5913,
  D: 146.8324,
  "D#": 155.5635,
  Eb: 155.5635,
  E: 164.8138,
  F: 174.6141,
  "F#": 184.9972,
  Gb: 184.9972,
  G: 195.9977,
  "G#": 207.6523,
  Ab: 207.6523,
  A: 220,
  "A#": 233.0819,
  Bb: 233.0819,
  B: 246.9417,
};

export const STAGE_PAD_KEYS = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export type StagePadKey = (typeof STAGE_PAD_KEYS)[number];

const normalizePadKey = (value?: string | null): StagePadKey => {
  const clean = String(value || "C")
    .trim()
    .replace(/m$/, "")
    .replace(/sus.*$/i, "")
    .replace(/add.*$/i, "");
  const aliases: Record<string, StagePadKey> = {
    Db: "C#",
    "D#": "Eb",
    Gb: "F#",
    "G#": "Ab",
    "A#": "Bb",
  };
  const normalized = aliases[clean] || clean;
  return (STAGE_PAD_KEYS as readonly string[]).includes(normalized)
    ? (normalized as StagePadKey)
    : "C";
};

interface Voice {
  oscillators: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
  dryGain: GainNode;
  delayGain: GainNode;
  delay: DelayNode;
  feedback: GainNode;
}

class StagePadEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private activeVoice: Voice | null = null;
  private activeKey: StagePadKey | null = null;
  private targetVolume = 0.46;

  private getContext() {
    if (!this.context) {
      this.context = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      this.master = this.context.createGain();
      this.master.gain.value = this.targetVolume;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private createVoice(key: StagePadKey): Voice {
    const context = this.getContext();
    const rootFrequency = NOTE_FREQUENCIES[key] || NOTE_FREQUENCIES.C;

    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const dryGain = context.createGain();
    const delay = context.createDelay(2.5);
    const feedback = context.createGain();
    const delayGain = context.createGain();

    gain.gain.value = 0.0001;
    filter.type = "lowpass";
    filter.frequency.value = 1350;
    filter.Q.value = 0.55;

    dryGain.gain.value = 0.72;
    delay.delayTime.value = 0.56;
    feedback.gain.value = 0.36;
    delayGain.gain.value = 0.24;

    gain.connect(filter);
    filter.connect(dryGain);
    dryGain.connect(this.master!);

    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(this.master!);

    const ratios = [0.5, 1, 1.5, 2];
    const detunes = [-6, 0, 5, -3];
    const types: OscillatorType[] = ["sine", "triangle", "sine", "triangle"];
    const voiceLevels = [0.28, 0.34, 0.18, 0.12];
    const oscillators: OscillatorNode[] = [];

    ratios.forEach((ratio, index) => {
      const oscillator = context.createOscillator();
      const oscillatorGain = context.createGain();
      oscillator.type = types[index];
      oscillator.frequency.value = rootFrequency * ratio;
      oscillator.detune.value = detunes[index];
      oscillatorGain.gain.value = voiceLevels[index];
      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(gain);
      oscillator.start();
      oscillators.push(oscillator);
    });

    return {
      oscillators,
      gain,
      filter,
      dryGain,
      delayGain,
      delay,
      feedback,
    };
  }

  private disposeVoice(voice: Voice, afterSeconds = 0) {
    const context = this.context;
    if (!context) return;

    const stopAt = context.currentTime + Math.max(0.02, afterSeconds);
    voice.oscillators.forEach((oscillator) => {
      try {
        oscillator.stop(stopAt);
      } catch {
        // Already stopped.
      }
    });
  }

  async start(keyInput?: string | null) {
    const context = this.getContext();
    if (context.state === "suspended") await context.resume();

    const key = normalizePadKey(keyInput);
    if (this.activeVoice && this.activeKey === key) {
      return key;
    }

    const nextVoice = this.createVoice(key);
    const now = context.currentTime;
    nextVoice.gain.gain.cancelScheduledValues(now);
    nextVoice.gain.gain.setValueAtTime(0.0001, now);
    nextVoice.gain.gain.exponentialRampToValueAtTime(0.82, now + 1.1);

    const previous = this.activeVoice;
    if (previous) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(
        Math.max(0.0001, previous.gain.gain.value),
        now,
      );
      previous.gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
      this.disposeVoice(previous, 1.45);
    }

    this.activeVoice = nextVoice;
    this.activeKey = key;
    return key;
  }

  async changeKey(keyInput: string) {
    return this.start(keyInput);
  }

  stop(fadeSeconds = 0.9) {
    const context = this.context;
    const voice = this.activeVoice;
    if (!context || !voice) {
      this.activeVoice = null;
      this.activeKey = null;
      return;
    }

    const now = context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(
      Math.max(0.0001, voice.gain.gain.value),
      now,
    );
    voice.gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.max(0.08, fadeSeconds),
    );
    this.disposeVoice(voice, Math.max(0.1, fadeSeconds) + 0.08);
    this.activeVoice = null;
    this.activeKey = null;
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

  isPlaying() {
    return !!this.activeVoice;
  }
}

export const stagePadEngine = new StagePadEngine();
export { normalizePadKey };
