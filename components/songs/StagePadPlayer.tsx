import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STAGE_PAD_KEYS,
  formatPadDisplayKey,
  normalizePadKey,
  stagePadEngine,
  type StagePadKey,
  type StagePadPreset,
} from '../../services/stagePadEngine';
import {
  readStagePadDeviceOutputPreference,
  writeStagePadDeviceOutputPreference,
} from '../../services/stagePadDevicePreference';
import {
  clearCustomPadAsset,
  readCustomPadAsset,
  saveCustomPadAsset,
} from '../../services/offline/customPadStorage';
import type { CustomPadAssetRow } from '../../services/offline/database';
import { getStageToolsV2Copy } from '../../services/stageToolsV2Copy';

interface StagePadPlayerProps {
  songKey?: string | null;
  userId?: string | null;
  organizationId?: string | null;
}

const PRESETS: Exclude<StagePadPreset, never>[] = ['worship', 'warm', 'air', 'deep', 'custom'];

const StagePadPlayer: React.FC<StagePadPlayerProps> = ({ songKey, userId, organizationId }) => {
  const { t, i18n } = useTranslation();
  const copy = getStageToolsV2Copy(i18n.resolvedLanguage || i18n.language);
  const hasSongContext = Boolean(String(songKey || '').trim());
  const initialKey = useMemo(() => normalizePadKey(songKey), [songKey]);
  const [selectedKey, setSelectedKey] = useState<StagePadKey>(initialKey);
  const [isPlaying, setIsPlaying] = useState(false);
  const [followSongKey, setFollowSongKey] = useState(hasSongContext);
  const [volume, setVolume] = useState(stagePadEngine.getVolume());
  const [deviceOutputEnabled, setDeviceOutputEnabled] = useState(readStagePadDeviceOutputPreference);
  const [preset, setPreset] = useState<StagePadPreset>('worship');
  const [customAsset, setCustomAsset] = useState<CustomPadAssetRow | null>(null);
  const [customBaseKey, setCustomBaseKey] = useState<StagePadKey>('C');
  const [audioError, setAudioError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasCustomScope = Boolean(userId && organizationId);

  useEffect(() => {
    let active = true;
    if (!userId || !organizationId) {
      setCustomAsset(null);
      return;
    }
    void readCustomPadAsset(userId, organizationId)
      .then((asset) => {
        if (!active) return;
        setCustomAsset(asset);
        if (asset?.baseKey) setCustomBaseKey(normalizePadKey(asset.baseKey));
      })
      .catch(() => {
        if (active) setCustomAsset(null);
      });
    return () => {
      active = false;
    };
  }, [userId, organizationId]);

  useEffect(() => {
    if (!hasSongContext) {
      setFollowSongKey(false);
      return;
    }
    if (!followSongKey) return;

    const next = normalizePadKey(songKey);
    setSelectedKey(next);
    if (isPlaying && deviceOutputEnabled) {
      void stagePadEngine.changeKey(next, preset, customAsset).catch(() => setIsPlaying(false));
    }
  }, [customAsset, deviceOutputEnabled, followSongKey, hasSongContext, isPlaying, preset, songKey]);

  useEffect(() => {
    return () => {
      stagePadEngine.stop(0.65);
    };
  }, []);

  const resolveAudioError = (error: unknown) => {
    const code = error instanceof Error ? error.message : String(error || '');
    if (code.includes('CUSTOM_PAD_MISSING')) return copy.pad.customMissing;
    if (code.includes('PAD_FILE_TOO_LARGE')) return copy.pad.fileTooLarge;
    if (code.includes('PAD_FILE_UNSUPPORTED')) return copy.pad.unsupportedFile;
    return copy.pad.audioBlocked;
  };

  const selectKey = (key: StagePadKey) => {
    setAudioError(null);
    setFollowSongKey(false);
    setSelectedKey(key);
    if (isPlaying && deviceOutputEnabled) {
      void stagePadEngine.changeKey(key, preset, customAsset).catch((error) => {
        setAudioError(resolveAudioError(error));
        setIsPlaying(false);
      });
    }
  };

  const toggleDeviceOutput = () => {
    const next = !deviceOutputEnabled;
    setDeviceOutputEnabled(next);
    writeStagePadDeviceOutputPreference(next);
    setAudioError(null);

    if (!next) {
      stagePadEngine.stop(0.35);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (!deviceOutputEnabled) return;
    setAudioError(null);

    if (isPlaying) {
      stagePadEngine.stop();
      setIsPlaying(false);
      return;
    }

    try {
      const startedKey = await stagePadEngine.start(selectedKey, preset, customAsset);
      setSelectedKey(startedKey);
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      setAudioError(resolveAudioError(error));
    }
  };

  const selectPreset = (nextPreset: StagePadPreset) => {
    setPreset(nextPreset);
    setAudioError(null);
    if (isPlaying && deviceOutputEnabled) {
      if (nextPreset === 'custom' && !customAsset) {
        stagePadEngine.stop(0.35);
        setIsPlaying(false);
        setAudioError(copy.pad.customMissing);
        return;
      }
      void stagePadEngine.changeKey(selectedKey, nextPreset, customAsset).catch((error) => {
        setAudioError(resolveAudioError(error));
        setIsPlaying(false);
      });
    }
  };

  const handleCustomFile = async (file?: File | null) => {
    if (!file || !userId || !organizationId) return;
    setAudioError(null);
    try {
      const asset = await saveCustomPadAsset({
        userId,
        organizationId,
        file,
        baseKey: customBaseKey,
      });
      setCustomAsset(asset);
      setPreset('custom');
      if (isPlaying && deviceOutputEnabled) {
        await stagePadEngine.changeKey(selectedKey, 'custom', asset);
      }
    } catch (error) {
      setAudioError(resolveAudioError(error));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateCustomBaseKey = async (next: StagePadKey) => {
    setCustomBaseKey(next);
    if (!customAsset || !userId || !organizationId) return;
    try {
      const renamedFile = new File([customAsset.blob], customAsset.name, { type: customAsset.mimeType });
      const asset = await saveCustomPadAsset({
        userId,
        organizationId,
        file: renamedFile,
        baseKey: next,
      });
      setCustomAsset(asset);
      if (isPlaying && preset === 'custom') {
        await stagePadEngine.changeKey(selectedKey, 'custom', asset);
      }
    } catch (error) {
      setAudioError(resolveAudioError(error));
    }
  };

  const removeCustomPad = async () => {
    if (!userId || !organizationId) return;
    await clearCustomPadAsset(userId, organizationId);
    setCustomAsset(null);
    if (preset === 'custom') {
      stagePadEngine.stop(0.35);
      setIsPlaying(false);
      setPreset('worship');
    }
  };

  const returnToConduction = () => {
    if (!hasSongContext) return;
    const next = normalizePadKey(songKey);
    setFollowSongKey(true);
    setSelectedKey(next);
    if (isPlaying && deviceOutputEnabled) {
      void stagePadEngine.changeKey(next, preset, customAsset).catch(() => setIsPlaying(false));
    }
  };

  const displayedKey = hasSongContext && followSongKey
    ? formatPadDisplayKey(songKey)
    : formatPadDisplayKey(selectedKey);

  const deviceStatus = !deviceOutputEnabled
    ? copy.pad.disabled
    : isPlaying
      ? copy.pad.playing
      : copy.pad.ready;

  return (
    <div className="min-w-0 w-full select-none overflow-hidden text-white">
      <button
        type="button"
        role="switch"
        aria-checked={deviceOutputEnabled}
        aria-label={copy.pad.audioOnDevice}
        data-testid="stage-pad-device-output"
        onClick={toggleDeviceOutput}
        className="mb-4 flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-left transition-colors active:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200/55"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-white/78">{copy.pad.audioOnDevice}</p>
          <p
            role="status"
            data-testid="stage-pad-device-status"
            className={`mt-1 truncate text-[10px] font-medium ${
              deviceOutputEnabled
                ? isPlaying
                  ? 'text-emerald-200/78'
                  : 'text-white/38'
                : 'text-amber-200/72'
            }`}
          >
            {deviceStatus}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
            deviceOutputEnabled
              ? 'border-violet-200/30 bg-violet-300/85'
              : 'border-white/[0.08] bg-white/[0.05]'
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              deviceOutputEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </span>
      </button>

      <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_7rem] sm:items-center">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={!deviceOutputEnabled}
          data-testid="stage-pad-play"
          className={`flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-bold transition-all active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-35 sm:h-14 sm:w-14 sm:px-0 ${
            isPlaying
              ? 'border-violet-200 bg-violet-300 text-black shadow-[0_10px_30px_rgba(196,181,253,0.18)]'
              : 'border-white/[0.08] bg-white/[0.055] text-white hover:bg-white/[0.09]'
          }`}
          aria-label={isPlaying ? copy.pad.stop : copy.pad.play}
        >
          {isPlaying ? (
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-4 w-1.5 rounded-full bg-current" />
              <span className="h-4 w-1.5 rounded-full bg-current" />
            </span>
          ) : (
            <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" aria-hidden="true" />
          )}
          <span className="sm:hidden">{isPlaying ? copy.pad.stop : copy.pad.play}</span>
        </button>

        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">{t('pad.label')}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <span data-testid="stage-pad-display-key" className="text-[28px] font-black leading-none tracking-[-0.04em]">
              {displayedKey}
            </span>
            <span
              data-testid="stage-pad-control-mode"
              className={`flex min-w-0 items-center rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${
                hasSongContext && followSongKey
                  ? 'border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200/70'
                  : 'border-white/[0.07] bg-white/[0.025] text-white/36'
              }`}
            >
              {hasSongContext && followSongKey ? t('pad.follow_conduction') : t('pad.individual_control')}
            </span>
          </div>
        </div>

        <label className="min-w-0 sm:w-28">
          <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{copy.pad.volume}</span>
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
            aria-label={copy.pad.volume}
          />
        </label>
      </div>

      {audioError && (
        <p role="alert" className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.055] px-3 py-2 text-[10px] leading-relaxed text-amber-100/80">
          {audioError}
        </p>
      )}

      <div className="mt-5 min-w-0">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">{copy.pad.preset}</p>
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
          {PRESETS.map((item) => (
            <button
              key={item}
              type="button"
              data-testid={`stage-pad-preset-${item}`}
              onClick={() => selectPreset(item)}
              className={`h-9 shrink-0 rounded-full border px-3 text-[10px] font-bold transition-all active:scale-[0.97] ${
                preset === item
                  ? 'border-violet-200/40 bg-violet-300/15 text-violet-100'
                  : 'border-white/[0.06] bg-white/[0.025] text-white/46 hover:text-white/76'
              }`}
            >
              {copy.pad.presets[item]}
            </button>
          ))}
        </div>
      </div>

      {preset === 'custom' && hasCustomScope && (
        <div className="mt-3 min-w-0 rounded-2xl border border-white/[0.065] bg-white/[0.018] p-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-white/82">{copy.pad.customTitle}</p>
              <p className="mt-1 break-words text-[10px] leading-relaxed text-white/38">
                {customAsset ? customAsset.name : copy.pad.customEmpty}
              </p>
              <p className="mt-1 text-[9px] text-white/27">{copy.pad.localOnly}</p>
            </div>
            <label className="min-w-0 sm:w-40">
              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-white/30">{copy.pad.baseKey}</span>
              <select
                value={customBaseKey}
                onChange={(event) => void updateCustomBaseKey(event.target.value as StagePadKey)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-xs text-white outline-none focus:border-violet-200/35"
              >
                {STAGE_PAD_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.m4a,.wav,.aac,audio/*"
              className="hidden"
              onChange={(event) => void handleCustomFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-10 rounded-xl border border-violet-200/20 bg-violet-300/[0.08] px-3 text-[10px] font-bold text-violet-100/85"
            >
              {customAsset ? copy.pad.replaceAudio : copy.pad.importAudio}
            </button>
            {customAsset && (
              <button
                type="button"
                onClick={() => void removeCustomPad()}
                className="min-h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[10px] font-bold text-white/45"
              >
                {copy.pad.removeAudio}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex max-w-full gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
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
        <button type="button" onClick={returnToConduction} className="mt-3 text-[10px] font-bold text-violet-200/60 transition-colors hover:text-violet-100">
          {t('pad.return_to_conduction')}
        </button>
      )}

      <p className="mt-3 break-words text-[10px] leading-relaxed text-white/27">{t('pad.neutral_note')}</p>
    </div>
  );
};

export default StagePadPlayer;
