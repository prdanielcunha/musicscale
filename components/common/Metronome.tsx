import React, { useState, useEffect, useRef, useCallback } from "react";

interface MetronomeProps {
  initialBpm?: number | null;
}

const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
      clipRule="evenodd"
    />
  </svg>
);

const PauseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
      clipRule="evenodd"
    />
  </svg>
);

const Metronome: React.FC<MetronomeProps> = ({ initialBpm }) => {
  const [bpm, setBpm] = useState(initialBpm || 72);
  const [isPlaying, setIsPlaying] = useState(false);

  // Audio Context refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0.0);
  const timerIDRef = useRef<number | null>(null);
  const lookahead = 25.0; // ms
  const scheduleAheadTime = 0.1; // s

  useEffect(() => {
    setBpm(initialBpm || 72);
  }, [initialBpm]);

  useEffect(() => {
    return () => {
      if (timerIDRef.current) {
        window.clearInterval(timerIDRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playClick = (time: number) => {
    if (!audioContextRef.current) return;

    const osc = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    // Click sound configuration (High pitch, short decay)
    osc.frequency.value = 1200;
    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  };

  const scheduler = useCallback(() => {
    if (!audioContextRef.current) return;

    while (
      nextNoteTimeRef.current <
      audioContextRef.current.currentTime + scheduleAheadTime
    ) {
      playClick(nextNoteTimeRef.current);
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTimeRef.current += secondsPerBeat;
    }
  }, [bpm]);

  const start = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    setIsPlaying(true);
    nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
    timerIDRef.current = window.setInterval(scheduler, lookahead);
  };

  const stop = () => {
    setIsPlaying(false);
    if (timerIDRef.current) {
      window.clearInterval(timerIDRef.current);
      timerIDRef.current = null;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  };

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBpm(Number(e.target.value));
  };

  return (
    <div className="flex items-center justify-between gap-4 text-white">
      <div className="flex flex-col min-w-[80px]">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Metronome
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-blue-500 tracking-tighter">
            {bpm}
          </span>
          <span className="text-xs font-medium text-gray-500">BPM</span>
        </div>
      </div>

      <div className="flex-grow mx-4">
        <input
          type="range"
          min="40"
          max="240"
          value={bpm}
          onChange={handleBpmChange}
          className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          aria-label="BPM slider"
        />
      </div>

      <button
        onClick={togglePlay}
        className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
          isPlaying
            ? "bg-red-500 hover:bg-red-600 text-white scale-95"
            : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-105"
        }`}
        aria-label={isPlaying ? "Parar metrônomo" : "Iniciar metrônomo"}
      >
        {isPlaying ? (
          <PauseIcon className="w-7 h-7" />
        ) : (
          <PlayIcon className="w-7 h-7 ml-1" />
        )}
      </button>
    </div>
  );
};

export default Metronome;
