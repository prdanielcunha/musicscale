import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STAGE_PAD_KEYS,
  formatPadDisplayKey,
  normalizePadKey,
  stagePadEngine,
  type StagePadKey,
} from '../../services/stagePadEngine';
import {
  readStagePadDeviceOutputPreference,
  writeStagePadDeviceOutputPreference,
} from '../../services/stagePadDevicePreference';

interface StagePadPlayerProps {
  songKey?: string | null;
}

const StagePadPlayer: React.FC<StagePadPlayerProps> = ({ songKey }) => {
  const { t } = useTranslation();
  const hasSongContext = Boolean(String(songKey || '').trim());
  const initialKey = useMemo(() => normalizePadKey(songKey), [songKey]);
  const [selectedKey, setSelectedKey] = useState<StagePadKey>(initialKey);
  const [isPlaying, setIsPlaying] = useState(false);
  const [followSongKey, setFollowSongKey] = useState(hasSongContext);
  const [volume, setVolume] = useState(stagePadEngine.getVolume());
  const [deviceOutputEnabled, setDeviceOutputEnabled] = useState(
    readStagePadDeviceOutputPreference,
  );

  useEffect(() => {
    if (!hasSongContext) {
      setFollowSongKey(false);
      return;
    }
    if (!followSongKey) return;

    const next = normalizePadKey(songKey);
    setSelectedKey(next);
    if (isPlaying && deviceOutputEnabled) {
      void stagePadEngine.changeKey(next);
    }
  }, [deviceOutputEnabled, followSongKey, hasSongContext, isPlaying, songKey]);

  useEffect(() => {
    return () => {
      stagePadEngine.stop(0.65);
    };
  }, []);

  const selectKey = (key: StagePadKey) => {
    setFollowSongKey(false);
    setSelectedKey(key);
    if (isPlaying && deviceOutputEnabled) {
      void stagePadEngine.changeKey(key);
    }
  };

  const toggleDeviceOutput = () => {
    const next = !deviceOutputEnabled;
    setDeviceOutputEnabled(next);
    writeStagePadDeviceOutputPreference(next);

    if (!next) {
      stagePadEngine.stop(0.35);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (!deviceOutputEnabled) return;

    if (isPlaying) {
      stagePadEngine.stop();
      setIsPlaying(false);
      return;
    }

    const startedKey = await stagePadEngine.start(selectedKey);
    setSelectedKey(startedKey);
    setIsPlaying(true);
  };

  const returnToConduction = () => {
    if (!hasSongContext) return;
    const next = normalizePadKey(songKey);
    setFollowSongKey(true);
    setSelectedKey(next);
    if (isPlaying && deviceOutputEnabled) {
      void stagePadEngine.changeKey(next);
    }
  };

  const displayedKey =
    hasSongContext && followSongKey
      ? formatPadDisplayKey(songKey)
      : formatPadDisplayKey(selectedKey);

  const deviceStatusKey = !deviceOutputEnabled
    ? 'pad.device_disabled'
    : isPlaying
      ? 'pad.device_playing'
      : 'pad.device_ready';

  return (
    <div className="w-full select-none text-white">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-white/78">
            {t('pad.device_output')}
          </p>
          <p
            role="status"
            data-testid="stage-pad-device-status"
            className={`mt-1 text-[10px] font-medium ${
              deviceOutputEnabled
                ? isPlaying
                  ? 'text-emerald-200/78'
                  : 'text-white/38'
                : 'text-amber-200/72'
            }`}
          >
            {t(deviceStatusKey)}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={deviceOutputEnabled}
          aria-label={t('pad.device_output')}
          data-testid="stage-pad-device-output"
          onClick={toggleDeviceOutput}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200/55 ${
            deviceOutputEnabled
              ? 'border-violet-200/30 bg-violet-300/85'
              : 'border-white/[0.08] bg-white/[0.05]'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              deviceOutputEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={!deviceOutputEnabled}
          data-testid="stage-pad-play"
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 ${
            isPlaying
              ? 'border-violet-200 bg-violet-300 text-black shadow-[0_10px_30px_rgba(196,181,253,0.18)]'
              : 'border-white/[0.08] bg-white/[0.055] text-white hover:bg-white/[0.09]'
          }`}
          aria-label={isPlaying ? t('pad.stop') : t('pad.start')}
        >
          {isPlaying ? (
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-5 w-1.5 rounded-full bg-current" />
              <span className="h-5 w-1.5 rounded-full bg-current" />
            </span>
          ) : (
            <span
              className="ml-1 h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-current"
              aria-hidden="true"
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
            {t('pad.label')}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              data-testid="stage-pad-display-key"
              className="text-[28px] font-black leading-none tracking-[-0.04em]"
            >
              {displayedKey}
            </span>
            <span
              data-testid="stage-pad-control-mode"
              className={`flex h-6 items-center rounded-full border px-2.5 text-[9px] font-bold uppercase tracking-[0.11em] ${
                hasSongContext && followSongKey
                  ? 'border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200/70'
                  : 'border-white/[0.07] bg-white/[0.025] text-white/36'
              }`}
            >
              {hasSongContext && followSongKey
                ? t('pad.follow_conduction')
                : t('pad.individual_control')}
            </span>
          </div>
        </div>

        <label className="w-24 md:w-28">
          <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">
            {t('pad.volume')}
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
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-violet-200"
            aria-label={t('pad.volume_control')}
          />
        </label>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
        {STAGE_PAD_KEYS.map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => selectKey(key)}
            aria-label={t('pad.select_key', { key })}
            className={`h-9 min-w-10 shrink-0 rounded-full border px-3 text-[10px] font-black transition-all active:scale-[0.97] ${
              selectedKey === key && !(hasSongContext && followSongKey)
                ? 'border-white bg-white text-black shadow-[0_7px_20px_rgba(255,255,255,0.08)]'
                : 'border-white/[0.06] bg-white/[0.025] text-white/38 hover:bg-white/[0.05] hover:text-white/72'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {hasSongContext && !followSongKey && (
        <button
          type="button"
          onClick={returnToConduction}
          className="mt-3 text-[10px] font-bold text-violet-200/60 transition-colors hover:text-violet-100"
        >
          {t('pad.return_to_conduction')}
        </button>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-white/27">
        {t('pad.neutral_note')}
      </p>
    </div>
  );
};

export default StagePadPlayer;
