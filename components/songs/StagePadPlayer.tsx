import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  STAGE_PAD_KEYS,
  formatPadDisplayKey,
  normalizePadKey,
  stagePadEngine,
  type StagePadKey,
} from "../../services/stagePadEngine";

interface StagePadPlayerProps {
  songKey?: string | null;
}

const StagePadPlayer: React.FC<StagePadPlayerProps> = ({ songKey }) => {
  const { t } = useTranslation();
  const initialKey = useMemo(() => normalizePadKey(songKey), [songKey]);
  const [selectedKey, setSelectedKey] = useState<StagePadKey>(initialKey);
  const [isPlaying, setIsPlaying] = useState(false);
  const [followSongKey, setFollowSongKey] = useState(true);
  const [volume, setVolume] = useState(stagePadEngine.getVolume());

  useEffect(() => {
    if (!followSongKey) return;
    const next = normalizePadKey(songKey);
    setSelectedKey(next);
    if (stagePadEngine.isPlaying()) {
      void stagePadEngine.changeKey(next);
      setIsPlaying(true);
    }
  }, [followSongKey, songKey]);

  useEffect(() => {
    return () => {
      stagePadEngine.stop(0.65);
    };
  }, []);

  const selectKey = (key: StagePadKey) => {
    setFollowSongKey(false);
    setSelectedKey(key);
    if (isPlaying) {
      void stagePadEngine.changeKey(key);
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      stagePadEngine.stop();
      setIsPlaying(false);
      return;
    }

    const startedKey = await stagePadEngine.start(selectedKey);
    setSelectedKey(startedKey);
    setIsPlaying(true);
  };

  return (
    <div className="w-full text-white select-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className={`w-14 h-14 shrink-0 rounded-2xl border flex items-center justify-center transition-all active:scale-[0.97] ${
            isPlaying
              ? "bg-violet-300 text-black border-violet-200 shadow-[0_10px_30px_rgba(196,181,253,0.18)]"
              : "bg-white/[0.055] text-white border-white/[0.08] hover:bg-white/[0.09]"
          }`}
          aria-label={
            isPlaying
              ? t("pad.stop", "Parar Pad")
              : t("pad.start", "Iniciar Pad")
          }
        >
          {isPlaying ? (
            <span className="flex gap-1">
              <span className="w-1.5 h-5 rounded-full bg-current" />
              <span className="w-1.5 h-5 rounded-full bg-current" />
            </span>
          ) : (
            <span className="ml-1 w-0 h-0 border-y-[9px] border-y-transparent border-l-[14px] border-l-current" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
            {t("pad.label", "Ambient Pad")}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[28px] leading-none font-black tracking-[-0.04em]">
              {followSongKey ? formatPadDisplayKey(songKey) : selectedKey}
            </span>
            <span
              className={`h-6 px-2.5 rounded-full border flex items-center text-[9px] font-bold uppercase tracking-[0.11em] ${
                followSongKey
                  ? "border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200/70"
                  : "border-white/[0.07] bg-white/[0.025] text-white/32"
              }`}
            >
              {followSongKey
                ? t("pad.follow_key", "Segue tom")
                : t("pad.manual_key", "Tom manual")}
            </span>
          </div>
        </div>

        <label className="w-24 md:w-28">
          <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-white/25 mb-2">
            {t("pad.volume", "Volume")}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              stagePadEngine.setVolume(next);
            }}
            className="w-full h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-violet-200"
            aria-label={t("pad.volume_control", "Volume do Pad")}
          />
        </label>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
        {STAGE_PAD_KEYS.map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => selectKey(key)}
            className={`shrink-0 h-9 min-w-10 px-3 rounded-full border text-[10px] font-black transition-all active:scale-[0.97] ${
              selectedKey === key
                ? "bg-white text-black border-white shadow-[0_7px_20px_rgba(255,255,255,0.08)]"
                : "bg-white/[0.025] border-white/[0.06] text-white/38 hover:text-white/72 hover:bg-white/[0.05]"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {!followSongKey && (
        <button
          type="button"
          onClick={() => {
            const next = normalizePadKey(songKey);
            setFollowSongKey(true);
            setSelectedKey(next);
            if (isPlaying) void stagePadEngine.changeKey(next);
          }}
          className="mt-3 text-[10px] font-bold text-violet-200/60 hover:text-violet-100 transition-colors"
        >
          {t("pad.return_to_song_key", "Voltar a seguir o tom da música")}
        </button>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-white/25">
        {t(
          "pad.native_note",
          "Pad nativo do MusicScale: funciona offline e faz crossfade suave ao trocar de tom.",
        )}
      </p>
    </div>
  );
};

export default StagePadPlayer;
