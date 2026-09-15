import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useCapability } from "../../hooks/useCapability";
import { getStageOutputCopy } from "../../lib/stageOutputCopy";
import { stageOutputCoordinator } from "../../services/stageOutputCoordinator";
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
  const { t, i18n } = useTranslation();
  const { user, effectiveOrganizationId } = useAuth();
  const { hasCapability } = useCapability();
  const copy = useMemo(
    () => getStageOutputCopy(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
  const canUseStageOutput =
    hasCapability("musicscale.live.conduct") ||
    hasCapability("musicscale.scales.manage");
  const outputCapabilities = useMemo(
    () => stagePadEngine.getAudioOutputCapabilities(),
    [],
  );

  const initialKey = useMemo(() => normalizePadKey(songKey), [songKey]);
  const [selectedKey, setSelectedKey] = useState<StagePadKey>(initialKey);
  const [isPlaying, setIsPlaying] = useState(false);
  const [followSongKey, setFollowSongKey] = useState(true);
  const [volume, setVolume] = useState(stagePadEngine.getVolume());
  const [showOutputPanel, setShowOutputPanel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [receiverNameDraft, setReceiverNameDraft] = useState("Este dispositivo");
  const [stageState, setStageState] = useState(() =>
    stageOutputCoordinator.getState(),
  );
  const stageStateRef = useRef(stageState);
  const selectedTargetRef = useRef("");
  const remoteVolumeTimer = useRef<number | null>(null);

  useEffect(() => {
    stageStateRef.current = stageState;
    setReceiverNameDraft(stageState.receiverName || "Este dispositivo");
  }, [stageState]);

  useEffect(() => {
    stageOutputCoordinator.configure({
      organizationId: effectiveOrganizationId || "",
      userId: user?.uid || "",
      canControl: canUseStageOutput,
    });
    return stageOutputCoordinator.subscribe(setStageState);
  }, [canUseStageOutput, effectiveOrganizationId, user?.uid]);

  const selectedRemote = useMemo(
    () =>
      stageState.receivers.find(
        (receiver) => receiver.deviceId === stageState.selectedTargetDeviceId,
      ) || null,
    [stageState.receivers, stageState.selectedTargetDeviceId],
  );
  const remotePlaying = !!selectedRemote?.state?.playing;
  const displayPlaying = selectedRemote
    ? remotePlaying
    : isPlaying || (stageState.receiverEnabled && stageState.localPlaying);

  useEffect(() => {
    selectedTargetRef.current = selectedRemote?.deviceId || "";
    if (selectedRemote) {
      setVolume(selectedRemote.state?.volume ?? stagePadEngine.getVolume());
    } else {
      setVolume(stagePadEngine.getVolume());
    }
  }, [selectedRemote?.deviceId, selectedRemote?.state?.volume]);

  const resolveError = (code: string | null) => {
    switch (code) {
      case "OUTPUT_DISCONNECTED":
        return copy.outputDisconnected;
      case "RECEIVER_NOT_READY":
      case "STAGE_OUTPUT_NOT_READY":
        return copy.receiverNotReady;
      case "AUDIO_ARM_FAILED":
        return copy.audioArmFailed;
      case "REALTIME_ERROR":
        return copy.realtimeError;
      case "AUDIO_PLAYBACK_FAILED":
        return copy.playbackFailed;
      case "STALE_COMMAND":
        return copy.staleCommand;
      case "STAGE_OUTPUT_ALREADY_PLAYING":
        return copy.playing;
      default:
        return code ? copy.receiverNotReady : null;
    }
  };

  const runStageAction = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (error: any) {
      setActionError(resolveError(error?.message || "STAGE_OUTPUT_NOT_READY"));
    }
  };

  useEffect(() => {
    if (!followSongKey) return;
    const next = normalizePadKey(songKey);
    setSelectedKey(next);

    if (selectedRemote?.state?.playing) {
      void runStageAction(() =>
        stageOutputCoordinator.sendKey(selectedRemote.deviceId, next),
      );
      return;
    }

    if (stagePadEngine.isPlaying() && !selectedRemote) {
      void stagePadEngine.changeKey(next);
      setIsPlaying(true);
    }
  }, [followSongKey, songKey, selectedRemote?.deviceId]);

  useEffect(() => {
    return () => {
      if (remoteVolumeTimer.current !== null) {
        window.clearTimeout(remoteVolumeTimer.current);
      }
      const remoteTarget = selectedTargetRef.current;
      if (remoteTarget) {
        void stageOutputCoordinator.sendStop(remoteTarget).catch(() => undefined);
      } else if (!stageStateRef.current.receiverEnabled) {
        stagePadEngine.stop(0.65);
      }
    };
  }, []);

  const selectKey = (key: StagePadKey) => {
    setFollowSongKey(false);
    setSelectedKey(key);
    if (selectedRemote?.state?.playing) {
      void runStageAction(() =>
        stageOutputCoordinator.sendKey(selectedRemote.deviceId, key),
      );
    } else if (stagePadEngine.isPlaying() && !selectedRemote) {
      void stagePadEngine.changeKey(key);
    }
  };

  const togglePlay = async () => {
    setActionError(null);
    if (selectedRemote) {
      await runStageAction(async () => {
        if (selectedRemote.state?.playing) {
          await stageOutputCoordinator.sendStop(selectedRemote.deviceId);
        } else {
          await stageOutputCoordinator.sendPlay(
            selectedRemote.deviceId,
            selectedKey,
            volume,
          );
        }
      });
      return;
    }

    if (stagePadEngine.isPlaying()) {
      stagePadEngine.stop();
      setIsPlaying(false);
      return;
    }

    const startedKey = await stagePadEngine.start(selectedKey);
    setSelectedKey(startedKey);
    setIsPlaying(true);
  };

  const changeDestination = async (deviceId: string) => {
    setActionError(null);
    if (selectedRemote?.state?.playing) {
      await stageOutputCoordinator
        .sendStop(selectedRemote.deviceId)
        .catch(() => undefined);
    } else if (!selectedRemote && stagePadEngine.isPlaying()) {
      stagePadEngine.stop(0.25);
      setIsPlaying(false);
    }
    stageOutputCoordinator.selectTarget(deviceId);
  };

  const changeVolume = (next: number) => {
    setVolume(next);
    if (!selectedRemote) {
      stagePadEngine.setVolume(next);
      return;
    }

    if (remoteVolumeTimer.current !== null) {
      window.clearTimeout(remoteVolumeTimer.current);
    }
    remoteVolumeTimer.current = window.setTimeout(() => {
      void runStageAction(() =>
        stageOutputCoordinator.sendVolume(selectedRemote.deviceId, next),
      );
    }, 180);
  };

  const selectedOutputLabel =
    stageState.outputLabel || copy.systemDefault;
  const visibleError = actionError || resolveError(stageState.error);

  return (
    <div className="w-full text-white select-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={!!selectedRemote && !selectedRemote.ready}
          className={`w-14 h-14 shrink-0 rounded-2xl border flex items-center justify-center transition-all active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed ${
            displayPlaying
              ? "bg-violet-300 text-black border-violet-200 shadow-[0_10px_30px_rgba(196,181,253,0.18)]"
              : "bg-white/[0.055] text-white border-white/[0.08] hover:bg-white/[0.09]"
          }`}
          aria-label={
            displayPlaying
              ? t("pad.stop", "Parar Pad")
              : t("pad.start", "Iniciar Pad")
          }
        >
          {displayPlaying ? (
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
            onChange={(event) => changeVolume(Number(event.target.value))}
            className="w-full h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-violet-200"
            aria-label={t("pad.volume_control", "Volume do Pad")}
          />
        </label>
      </div>

      {canUseStageOutput && (
        <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
          <div className="flex items-center gap-2 p-2.5">
            <div className="min-w-0 flex-1">
              <p className="px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/28">
                {copy.playOn}
              </p>
              <select
                value={selectedRemote?.deviceId || ""}
                onChange={(event) => void changeDestination(event.target.value)}
                className="mt-1 w-full bg-transparent text-[12px] font-bold text-white/85 outline-none cursor-pointer"
                aria-label={copy.playOn}
              >
                <option value="" className="bg-slate-950">
                  {copy.thisDevice} · {copy.local}
                </option>
                {stageState.receivers.map((receiver) => (
                  <option
                    key={receiver.deviceId}
                    value={receiver.deviceId}
                    className="bg-slate-950"
                  >
                    {receiver.name} · {receiver.ready ? copy.ready : copy.notReady}
                  </option>
                ))}
              </select>
            </div>

            {selectedRemote && (
              <div className="hidden sm:block max-w-40 text-right">
                <p className={`text-[10px] font-bold ${selectedRemote.ready ? "text-emerald-200/75" : "text-amber-200/70"}`}>
                  {selectedRemote.ready ? copy.ready : copy.notReady}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-white/28">
                  {selectedRemote.outputLabel || copy.systemDefault}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowOutputPanel((current) => !current)}
              className={`h-9 px-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.08em] transition-colors ${
                showOutputPanel
                  ? "border-violet-200/25 bg-violet-200/10 text-violet-100"
                  : "border-white/[0.07] bg-white/[0.035] text-white/45 hover:text-white/80"
              }`}
              aria-expanded={showOutputPanel}
              title={copy.openSettings}
            >
              {copy.output}
            </button>
          </div>

          {showOutputPanel && (
            <div className="border-t border-white/[0.06] p-3.5 md:p-4 bg-black/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-black tracking-[-0.01em]">
                      {copy.stageOutput}
                    </p>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        stageState.receiverReady
                          ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.45)]"
                          : "bg-white/20"
                      }`}
                    />
                  </div>
                  <p className="mt-1 max-w-xl text-[10px] leading-relaxed text-white/32">
                    {copy.stageOutputDescription}
                  </p>
                </div>

                {stageState.receiverEnabled && (
                  <button
                    type="button"
                    onClick={() => void runStageAction(() => stageOutputCoordinator.emergencyStop())}
                    className="h-9 px-3 rounded-xl border border-red-300/20 bg-red-300/[0.08] text-red-100/85 text-[10px] font-black tracking-[0.08em] hover:bg-red-300/[0.13] transition-colors"
                  >
                    {copy.emergencyStop}
                  </button>
                )}
              </div>

              {!stageState.receiverEnabled ? (
                <button
                  type="button"
                  onClick={() =>
                    void runStageAction(() =>
                      stageOutputCoordinator.enableReceiver(receiverNameDraft),
                    )
                  }
                  className="mt-4 w-full h-11 rounded-xl bg-violet-200 text-slate-950 text-[11px] font-black tracking-[-0.01em] hover:bg-violet-100 transition-colors"
                >
                  {copy.enableReceiver}
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/28">
                        {copy.receiverName}
                      </span>
                      <input
                        value={receiverNameDraft}
                        onChange={(event) => setReceiverNameDraft(event.target.value)}
                        onBlur={() => {
                          if (receiverNameDraft.trim() && receiverNameDraft !== stageState.receiverName) {
                            void runStageAction(() =>
                              stageOutputCoordinator.renameReceiver(receiverNameDraft),
                            );
                          }
                        }}
                        maxLength={40}
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 text-[11px] font-bold text-white/85 outline-none focus:border-violet-200/25"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/28">
                        {copy.audioOutput}
                      </span>
                      <select
                        value={stageState.outputDeviceId}
                        disabled={!outputCapabilities.explicitRouting}
                        onChange={(event) => {
                          const id = event.target.value;
                          const label =
                            stageState.outputs.find((output) => output.deviceId === id)?.label ||
                            copy.systemDefault;
                          void runStageAction(() =>
                            stageOutputCoordinator.chooseOutput(id, label),
                          );
                        }}
                        className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 text-[11px] font-bold text-white/85 outline-none disabled:opacity-45"
                      >
                        <option value="" className="bg-slate-950">
                          {copy.systemDefault}
                        </option>
                        {stageState.outputs
                          .filter((output) => output.deviceId && output.deviceId !== "default")
                          .map((output) => (
                            <option
                              key={output.deviceId}
                              value={output.deviceId}
                              className="bg-slate-950"
                            >
                              {output.label}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {outputCapabilities.browserChooser && (
                      <button
                        type="button"
                        onClick={() =>
                          void runStageAction(() =>
                            stageOutputCoordinator.chooseOutputWithBrowserPicker(),
                          )
                        }
                        className="h-9 px-3 rounded-xl border border-white/[0.07] bg-white/[0.035] text-[10px] font-bold text-white/60 hover:text-white/90 transition-colors"
                      >
                        {copy.chooseOutput}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void stageOutputCoordinator.refreshOutputs()}
                      className="h-9 px-3 rounded-xl border border-white/[0.07] bg-white/[0.035] text-[10px] font-bold text-white/45 hover:text-white/80 transition-colors"
                    >
                      {copy.refresh}
                    </button>
                    <button
                      type="button"
                      disabled={!stageState.receiverReady}
                      onClick={() =>
                        void runStageAction(() => stageOutputCoordinator.testOutput())
                      }
                      className="h-9 px-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] text-[10px] font-bold text-emerald-100/70 disabled:opacity-35 hover:bg-emerald-300/[0.1] transition-colors"
                    >
                      {copy.testOutput}
                    </button>
                    {!stageState.receiverReady && (
                      <button
                        type="button"
                        onClick={() =>
                          void runStageAction(() =>
                            stageOutputCoordinator.enableReceiver(receiverNameDraft),
                          )
                        }
                        className="h-9 px-3 rounded-xl border border-violet-200/20 bg-violet-200/[0.08] text-[10px] font-bold text-violet-100/80 hover:bg-violet-200/[0.13] transition-colors"
                      >
                        {copy.armAudio}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void runStageAction(() => stageOutputCoordinator.disableReceiver())
                      }
                      className="h-9 px-3 rounded-xl border border-white/[0.07] bg-white/[0.025] text-[10px] font-bold text-white/35 hover:text-red-100/75 transition-colors"
                    >
                      {copy.disableReceiver}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold ${stageState.receiverReady ? "text-emerald-200/75" : "text-white/38"}`}>
                        {stageState.receiverReady ? copy.ready : copy.notReady}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-white/25">
                        {selectedOutputLabel}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/20">
                      {stageState.connected ? copy.connected : copy.offline}
                    </span>
                  </div>

                  <p className="text-[9px] leading-relaxed text-white/24">
                    {outputCapabilities.explicitRouting
                      ? copy.sinkHint
                      : copy.browserUsesSystem}
                  </p>
                </div>
              )}

              {stageState.receivers.length === 0 && (
                <p className="mt-3 text-[9px] text-white/22">
                  {copy.noReceivers}
                </p>
              )}
              <p className="mt-2 text-[9px] leading-relaxed text-white/20">
                {copy.remoteHint}
              </p>
            </div>
          )}
        </div>
      )}

      {visibleError && (
        <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-[10px] leading-relaxed text-amber-100/70">
          {visibleError}
        </div>
      )}

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
            if (selectedRemote?.state?.playing) {
              void runStageAction(() =>
                stageOutputCoordinator.sendKey(selectedRemote.deviceId, next),
              );
            } else if (stagePadEngine.isPlaying() && !selectedRemote) {
              void stagePadEngine.changeKey(next);
            }
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
