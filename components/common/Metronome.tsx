import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface MetronomeProps {
  initialBpm?: number | null;
}

const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M8 5.5v13l10-6.5-10-6.5z" />
  </svg>
);

const PauseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" />
  </svg>
);

const clampBpm = (value: number) => Math.min(240, Math.max(40, Math.round(value)));

const Metronome: React.FC<MetronomeProps> = ({ initialBpm }) => {
  const { t } = useTranslation();
  const [bpm, setBpm] = useState(clampBpm(initialBpm || 72));
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatsPerBar, setBeatsPerBar] = useState<3 | 4 | 6>(4);
  const [subdivision, setSubdivision] = useState<1 | 2>(1);
  const [volume, setVolume] = useState(0.72);
  const [tapPulse, setTapPulse] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const startInFlightRef = useRef(false);
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const tapPulseTimeoutRef = useRef<number | null>(null);

  const bpmRef = useRef(bpm);
  const beatsPerBarRef = useRef(beatsPerBar);
  const subdivisionRef = useRef(subdivision);
  const volumeRef = useRef(volume);

  useEffect(() => {
    const next = clampBpm(initialBpm || 72);
    setBpm(next);
    bpmRef.current = next;
  }, [initialBpm]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    beatsPerBarRef.current = beatsPerBar;
    currentStepRef.current = 0;
  }, [beatsPerBar]);

  useEffect(() => {
    subdivisionRef.current = subdivision;
    currentStepRef.current = 0;
  }, [subdivision]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const disposeAudioContext = useCallback(() => {
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  }, []);

  const createUnlockedAudioContext = useCallback(async () => {
    const AudioContextConstructor =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextConstructor) {
      throw new Error("WEB_AUDIO_UNSUPPORTED");
    }

    // A fresh context on every new playback avoids reusing an iOS/WebKit
    // context that may report "running" after backgrounding while remaining silent.
    disposeAudioContext();

    const audioContext = new AudioContextConstructor({
      latencyHint: "interactive",
    }) as AudioContext;
    audioContextRef.current = audioContext;

    // Prime the output synchronously from the user's click. This tiny silent
    // buffer is a long-standing Safari/WebKit unlock pattern and does not
    // create an audible extra tick.
    const unlockBuffer = audioContext.createBuffer(1, 1, 22050);
    const unlockSource = audioContext.createBufferSource();
    const unlockGain = audioContext.createGain();
    unlockGain.gain.value = 0.0001;
    unlockSource.buffer = unlockBuffer;
    unlockSource.connect(unlockGain);
    unlockGain.connect(audioContext.destination);
    unlockSource.start(0);

    const state = String(audioContext.state);
    if (state !== "running") {
      const resumePromise = audioContext.resume();
      await Promise.race([
        resumePromise,
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("AUDIO_RESUME_TIMEOUT")), 1200);
        }),
      ]);
    }

    if (String(audioContext.state) !== "running") {
      throw new Error(`AUDIO_CONTEXT_${String(audioContext.state).toUpperCase()}`);
    }

    return audioContext;
  }, [disposeAudioContext]);

  const playClick = useCallback(
    (time: number, isAccent: boolean, isSubdivision: boolean) => {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(
        isAccent ? 1580 : isSubdivision ? 760 : 1120,
        time,
      );

      const baseGain = isAccent ? 0.9 : isSubdivision ? 0.32 : 0.62;
      const targetGain = Math.max(0.001, baseGain * volumeRef.current);
      gainNode.gain.setValueAtTime(targetGain, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

      oscillator.start(time);
      oscillator.stop(time + 0.05);
    },
    [],
  );

  const scheduler = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const scheduleAheadTime = 0.1;
    while (nextNoteTimeRef.current < audioContext.currentTime + scheduleAheadTime) {
      const sub = subdivisionRef.current;
      const stepsPerBar = beatsPerBarRef.current * sub;
      const step = currentStepRef.current % stepsPerBar;
      const isMainBeat = step % sub === 0;
      const isAccent = step === 0;

      playClick(nextNoteTimeRef.current, isAccent, !isMainBeat);

      const secondsPerBeat = 60 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat / sub;
      currentStepRef.current = (step + 1) % stepsPerBar;
    }
  }, [playClick]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    startInFlightRef.current = false;
    if (timerIDRef.current !== null) {
      window.clearInterval(timerIDRef.current);
      timerIDRef.current = null;
    }
    currentStepRef.current = 0;
    disposeAudioContext();
  }, [disposeAudioContext]);

  const start = useCallback(async () => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setAudioError(null);

    if (timerIDRef.current !== null) {
      window.clearInterval(timerIDRef.current);
      timerIDRef.current = null;
    }

    try {
      const audioContext = await createUnlockedAudioContext();

      currentStepRef.current = 0;
      nextNoteTimeRef.current = audioContext.currentTime + 0.02;

      // Schedule the first audible click immediately after the context is
      // confirmed running; do not wait for the first 25ms interval.
      scheduler();
      timerIDRef.current = window.setInterval(scheduler, 25);
      setIsPlaying(true);
    } catch (error) {
      console.error("[Metronome] Unable to start audio", error);
      if (timerIDRef.current !== null) {
        window.clearInterval(timerIDRef.current);
        timerIDRef.current = null;
      }
      disposeAudioContext();
      setIsPlaying(false);
      setAudioError(
        t(
          "metronome.audio_blocked",
          "O áudio não foi liberado pelo navegador. Toque em Play novamente.",
        ),
      );
    } finally {
      startInFlightRef.current = false;
    }
  }, [createUnlockedAudioContext, disposeAudioContext, scheduler, t]);

  const togglePlay = useCallback(() => {
    if (isPlaying) stop();
    else void start();
  }, [isPlaying, start, stop]);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const previous = tapTimesRef.current[tapTimesRef.current.length - 1];

    if (!previous || now - previous > 2000) {
      tapTimesRef.current = [now];
    } else {
      tapTimesRef.current = [...tapTimesRef.current, now].slice(-6);
    }

    if (tapTimesRef.current.length >= 2) {
      const intervals = tapTimesRef.current.slice(1).map(
        (time, index) => time - tapTimesRef.current[index],
      );
      const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      const nextBpm = clampBpm(60000 / average);
      setBpm(nextBpm);
      bpmRef.current = nextBpm;
    }

    setTapPulse(true);
    if (tapPulseTimeoutRef.current !== null) {
      window.clearTimeout(tapPulseTimeoutRef.current);
    }
    tapPulseTimeoutRef.current = window.setTimeout(() => setTapPulse(false), 120);
  }, []);

  useEffect(() => {
    return () => {
      if (timerIDRef.current !== null) window.clearInterval(timerIDRef.current);
      if (tapPulseTimeoutRef.current !== null) {
        window.clearTimeout(tapPulseTimeoutRef.current);
      }
      disposeAudioContext();
    };
  }, [disposeAudioContext]);

  return (
    <div className="w-full text-white select-none">
      <div className="flex items-center gap-3">
        <div className="min-w-[78px]">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
            {t("metronome.label", "Metrônomo")}
          </p>
          <div className="mt-0.5 flex items-end gap-1">
            <span className="text-[30px] leading-none font-black tracking-[-0.04em] text-white">
              {bpm}
            </span>
            <span className="pb-0.5 text-[9px] font-bold tracking-[0.12em] text-white/30">
              BPM
            </span>
          </div>
        </div>

        <input
          type="range"
          min="40"
          max="240"
          value={bpm}
          onChange={(event) => setBpm(clampBpm(Number(event.target.value)))}
          className="flex-1 h-1.5 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-white"
          aria-label={t("metronome.bpm_control", "Ajustar BPM")}
        />

        <button
          type="button"
          onClick={togglePlay}
          className={`w-12 h-12 shrink-0 rounded-full border flex items-center justify-center transition-all active:scale-[0.96] ${
            isPlaying
              ? "bg-emerald-400 text-black border-emerald-300 shadow-[0_8px_26px_rgba(52,211,153,0.22)]"
              : "bg-white text-black border-white hover:bg-white/90 shadow-[0_8px_26px_rgba(255,255,255,0.08)]"
          }`}
          aria-label={
            isPlaying
              ? t("metronome.stop", "Parar metrônomo")
              : t("metronome.start", "Iniciar metrônomo")
          }
        >
          {isPlaying ? (
            <PauseIcon className="w-5 h-5" />
          ) : (
            <PlayIcon className="w-5 h-5 ml-0.5" />
          )}
        </button>
      </div>

      {audioError && (
        <p
          className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-100/85"
          role="status"
        >
          {audioError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleTapTempo}
          className={`h-9 px-4 rounded-full border text-[10px] font-black uppercase tracking-[0.14em] transition-all active:scale-[0.97] ${
            tapPulse
              ? "bg-indigo-400 text-black border-indigo-300"
              : "bg-indigo-400/[0.08] text-indigo-200 border-indigo-300/[0.14] hover:bg-indigo-400/[0.14]"
          }`}
        >
          {t("metronome.tap", "Tap Tempo")}
        </button>

        <div className="h-9 flex items-center gap-1 rounded-full border border-white/[0.07] bg-black/20 p-1">
          {([3, 4, 6] as const).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setBeatsPerBar(value)}
              className={`h-7 min-w-9 px-2 rounded-full text-[10px] font-bold transition-all ${
                beatsPerBar === value
                  ? "bg-white text-black"
                  : "text-white/38 hover:text-white/75"
              }`}
              aria-label={t("metronome.time_signature", "{{value}} por compasso", { value })}
            >
              {value}/{value === 6 ? 8 : 4}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSubdivision((current) => (current === 1 ? 2 : 1))}
          className="h-9 px-3 rounded-full border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.06] text-[10px] font-bold text-white/52 hover:text-white/82 transition-all"
          title={t("metronome.subdivision_hint", "Alternar subdivisão do click")}
        >
          {subdivision === 1
            ? t("metronome.quarter", "1/4")
            : t("metronome.eighth", "1/8")}
        </button>

        <label className="ml-auto min-w-[96px] flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/28">
            {t("metronome.volume", "Vol.")}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="w-20 h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-white"
            aria-label={t("metronome.volume_control", "Volume do metrônomo")}
          />
        </label>
      </div>
    </div>
  );
};

export default Metronome;
