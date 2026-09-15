import { stagePadEngine, type StageAudioOutputDevice } from "./stagePadEngine";
import {
  clampStageOutputVolume,
  isStageReceiverFresh,
  publishStageReceiver,
  publishStageReceiverState,
  removeStageReceiver,
  sendStageOutputCommand,
  subscribeStageOutput,
  type StageOutputCommand,
  type StageOutputDesiredState,
  type StageOutputReceiver,
  type StageOutputReceiverState,
  type StageOutputSnapshot,
} from "./stageOutputService";

const DEVICE_ID_STORAGE_KEY = "musicscale.stageOutput.deviceId.v1";
const PREFS_STORAGE_PREFIX = "musicscale.stageOutput.preferences.v1";
const HEARTBEAT_MS = 30_000;
const PRESENCE_TICK_MS = 15_000;
const COMMAND_MAX_AGE_MS = 15_000;

export interface StageOutputPreferences {
  receiverEnabled: boolean;
  receiverName: string;
  outputDeviceId: string;
  outputLabel: string;
  selectedTargetDeviceId: string;
}

export interface StageOutputRuntimeState {
  organizationId: string;
  localDeviceId: string;
  receiverEnabled: boolean;
  receiverName: string;
  receiverReady: boolean;
  selectedTargetDeviceId: string;
  outputDeviceId: string;
  outputLabel: string;
  explicitOutput: boolean;
  outputs: StageAudioOutputDevice[];
  receivers: StageOutputReceiver[];
  localPlaying: boolean;
  localKey: string | null;
  localVolume: number;
  error: string | null;
  connected: boolean;
}

type RuntimeListener = (state: StageOutputRuntimeState) => void;

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `stage-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const storage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const loadDeviceId = () => {
  const store = storage();
  try {
    const existing = store?.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const next = createId();
    store?.setItem(DEVICE_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createId();
  }
};

const defaultDeviceName = () => {
  if (typeof navigator === "undefined") return "Este dispositivo";
  const ua = navigator.userAgent || "";
  if (
    /iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "iPad";
  }
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Windows/i.test(ua)) return "PC Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  return "Este dispositivo";
};

const defaultPreferences = (): StageOutputPreferences => ({
  receiverEnabled: false,
  receiverName: defaultDeviceName(),
  outputDeviceId: "",
  outputLabel: "Saída padrão do sistema",
  selectedTargetDeviceId: "",
});

const loadPreferences = (organizationId: string): StageOutputPreferences => {
  const store = storage();
  if (!store || !organizationId) return defaultPreferences();
  try {
    const raw = store.getItem(`${PREFS_STORAGE_PREFIX}.${organizationId}`);
    return raw
      ? { ...defaultPreferences(), ...JSON.parse(raw) }
      : defaultPreferences();
  } catch {
    return defaultPreferences();
  }
};

const savePreferences = (
  organizationId: string,
  preferences: StageOutputPreferences,
) => {
  if (!organizationId) return;
  try {
    storage()?.setItem(
      `${PREFS_STORAGE_PREFIX}.${organizationId}`,
      JSON.stringify(preferences),
    );
  } catch {
    // Private/incognito browsers may reject local persistence. Runtime still works.
  }
};

class StageOutputCoordinator {
  private organizationId = "";
  private userId = "";
  private canControl = false;
  private deviceId = loadDeviceId();
  private preferences = defaultPreferences();
  private snapshot: StageOutputSnapshot | null = null;
  private unsubscribeRemote: (() => void) | null = null;
  private unsubscribeDeviceChange: (() => void) | null = null;
  private heartbeatTimer: number | null = null;
  private presenceTimer: number | null = null;
  private listeners = new Set<RuntimeListener>();
  private lastProcessedCommandId = "";
  private ready = false;
  private outputs: StageAudioOutputDevice[] = [];
  private error: string | null = null;
  private currentKey: string | null = null;
  private connected = false;
  private testOutputToken = "";
  private desiredByTarget = new Map<string, StageOutputDesiredState>();

  configure({
    organizationId,
    userId,
    canControl,
  }: {
    organizationId: string;
    userId: string;
    canControl: boolean;
  }) {
    const contextChanged =
      this.organizationId !== organizationId || this.userId !== userId;
    const capabilityChanged = this.canControl !== canControl;

    if (!contextChanged && !capabilityChanged) return;

    const previousOrganizationId = this.organizationId;
    const previousReceiverEnabled = this.preferences.receiverEnabled;
    const previousCanControl = this.canControl;

    this.disconnectRealtime();

    if (contextChanged) {
      if (previousOrganizationId && previousReceiverEnabled && previousCanControl) {
        void removeStageReceiver(previousOrganizationId, this.deviceId).catch(
          () => undefined,
        );
      }
      stagePadEngine.stop(0.12);
      this.testOutputToken = "";
      this.organizationId = organizationId || "";
      this.userId = userId || "";
      this.preferences = loadPreferences(this.organizationId);
      this.snapshot = null;
      this.lastProcessedCommandId = "";
      this.ready = false;
      this.error = null;
      this.connected = false;
      this.currentKey = null;
      this.desiredByTarget.clear();
    }

    this.canControl = canControl;
    if (!this.canControl) {
      stagePadEngine.stop(0.12);
      this.ready = false;
    }

    if (!this.organizationId || !this.userId) {
      this.emit();
      return;
    }

    this.unsubscribeRemote = subscribeStageOutput(
      this.organizationId,
      (snapshot) => {
        this.connected = true;
        this.snapshot = snapshot;
        this.reconcileSelectedTarget();
        void this.handleIncomingCommand(snapshot?.command || null);
        this.emit();
      },
      () => {
        this.connected = false;
        this.error = "REALTIME_ERROR";
        this.emit();
      },
    );

    this.unsubscribeDeviceChange = stagePadEngine.onAudioOutputsChanged(() => {
      void this.handleAudioOutputsChanged();
    });

    this.startPresenceTicker();
    void this.refreshOutputs();
    if (this.preferences.receiverEnabled && this.canControl) {
      void this.restoreReceiver();
    }
    this.emit();
  }

  subscribe(listener: RuntimeListener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private freshReceivers() {
    return Object.values(this.snapshot?.receivers || {})
      .filter((receiver) => receiver.deviceId !== this.deviceId)
      .filter((receiver) => isStageReceiverFresh(receiver))
      .sort(
        (a, b) =>
          Number(b.ready) - Number(a.ready) || a.name.localeCompare(b.name),
      );
  }

  getState(): StageOutputRuntimeState {
    const receivers = this.freshReceivers();
    const selectedTargetDeviceId = receivers.some(
      (receiver) => receiver.deviceId === this.preferences.selectedTargetDeviceId,
    )
      ? this.preferences.selectedTargetDeviceId
      : "";

    return {
      organizationId: this.organizationId,
      localDeviceId: this.deviceId,
      receiverEnabled: this.preferences.receiverEnabled,
      receiverName: this.preferences.receiverName,
      receiverReady: this.ready,
      selectedTargetDeviceId,
      outputDeviceId: this.preferences.outputDeviceId,
      outputLabel: this.preferences.outputLabel,
      explicitOutput: !!this.preferences.outputDeviceId,
      outputs: this.outputs,
      receivers,
      localPlaying: stagePadEngine.isPlaying(),
      localKey: stagePadEngine.getActiveKey() || this.currentKey,
      localVolume: stagePadEngine.getVolume(),
      error: this.error,
      connected: this.connected,
    };
  }

  private emit() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private disconnectRealtime() {
    this.unsubscribeRemote?.();
    this.unsubscribeRemote = null;
    this.unsubscribeDeviceChange?.();
    this.unsubscribeDeviceChange = null;
    if (this.heartbeatTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.presenceTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.presenceTimer);
      this.presenceTimer = null;
    }
  }

  private startPresenceTicker() {
    if (typeof window === "undefined" || this.presenceTimer !== null) return;
    this.presenceTimer = window.setInterval(() => {
      this.reconcileSelectedTarget();
      this.emit();
    }, PRESENCE_TICK_MS);
  }

  private reconcileSelectedTarget() {
    const target = this.preferences.selectedTargetDeviceId;
    if (!target) return;
    const receiver = this.snapshot?.receivers?.[target];
    if (receiver && isStageReceiverFresh(receiver)) return;
    this.preferences.selectedTargetDeviceId = "";
    this.desiredByTarget.delete(target);
    this.savePreferences();
  }

  private savePreferences() {
    savePreferences(this.organizationId, this.preferences);
  }

  private receiverState(
    ackCommandId: string | null = null,
    error: string | null = this.error,
  ): StageOutputReceiverState {
    return {
      playing: stagePadEngine.isPlaying(),
      key: stagePadEngine.getActiveKey() || this.currentKey,
      volume: stagePadEngine.getVolume(),
      ackCommandId,
      updatedAt: Date.now(),
      error,
    };
  }

  private receiverRecord(): StageOutputReceiver {
    return {
      deviceId: this.deviceId,
      ownerUserId: this.userId,
      name: this.preferences.receiverName,
      available: this.preferences.receiverEnabled,
      ready: this.ready,
      outputLabel: this.preferences.outputLabel,
      explicitOutput: !!this.preferences.outputDeviceId,
      lastSeen: Date.now(),
      state: this.receiverState(),
    };
  }

  private async publishReceiver() {
    if (
      !this.organizationId ||
      !this.canControl ||
      !this.preferences.receiverEnabled
    ) {
      return;
    }
    await publishStageReceiver(this.organizationId, this.receiverRecord());
  }

  private startHeartbeat() {
    if (typeof window === "undefined" || this.heartbeatTimer !== null) return;
    this.heartbeatTimer = window.setInterval(() => {
      void this.publishReceiver().catch(() => {
        this.connected = false;
        this.emit();
      });
    }, HEARTBEAT_MS);
  }

  private async restoreReceiver() {
    try {
      await stagePadEngine.arm();
      if (this.preferences.outputDeviceId) {
        const available = await stagePadEngine.isOutputDeviceAvailable(
          this.preferences.outputDeviceId,
        );
        if (!available) {
          stagePadEngine.stop(0.12);
          this.ready = false;
          this.error = "OUTPUT_DISCONNECTED";
          await this.publishReceiver();
          this.startHeartbeat();
          this.emit();
          return;
        }
        await stagePadEngine.setOutputDevice(this.preferences.outputDeviceId);
      }
      this.ready = true;
      this.error = null;
      await this.publishReceiver();
      this.startHeartbeat();
      this.emit();
    } catch {
      stagePadEngine.stop(0.12);
      this.ready = false;
      this.error = "AUDIO_ARM_FAILED";
      await this.publishReceiver().catch(() => undefined);
      this.startHeartbeat();
      this.emit();
    }
  }

  async enableReceiver(name?: string) {
    if (!this.canControl) throw new Error("STAGE_OUTPUT_FORBIDDEN");
    this.preferences.receiverEnabled = true;
    if (name?.trim()) this.preferences.receiverName = name.trim().slice(0, 40);
    this.savePreferences();
    await this.restoreReceiver();
  }

  async disableReceiver() {
    this.testOutputToken = "";
    stagePadEngine.stop(0.15);
    this.ready = false;
    this.error = null;
    this.preferences.receiverEnabled = false;
    this.savePreferences();
    if (this.heartbeatTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.organizationId && this.canControl) {
      await removeStageReceiver(this.organizationId, this.deviceId).catch(
        () => undefined,
      );
    }
    this.emit();
  }

  async renameReceiver(name: string) {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    this.preferences.receiverName = clean;
    this.savePreferences();
    await this.publishReceiver();
    this.emit();
  }

  async refreshOutputs() {
    this.outputs = await stagePadEngine.listAudioOutputs().catch(() => []);
    this.emit();
    return this.outputs;
  }

  async chooseOutput(deviceId: string, label?: string) {
    if (!this.canControl) throw new Error("STAGE_OUTPUT_FORBIDDEN");
    try {
      await stagePadEngine.arm();
      await stagePadEngine.setOutputDevice(deviceId);
      this.preferences.outputDeviceId = deviceId === "default" ? "" : deviceId;
      this.preferences.outputLabel =
        label ||
        this.outputs.find((output) => output.deviceId === deviceId)?.label ||
        (deviceId ? "Saída de áudio selecionada" : "Saída padrão do sistema");
      this.savePreferences();
      this.ready = this.preferences.receiverEnabled;
      this.error = null;
      await this.refreshOutputs();
      await this.publishReceiver();
      this.emit();
    } catch (error) {
      this.testOutputToken = "";
      stagePadEngine.stop(0.12);
      this.ready = false;
      this.error = "AUDIO_OUTPUT_SELECTION_FAILED";
      await this.publishReceiver().catch(() => undefined);
      this.emit();
      throw error;
    }
  }

  async chooseOutputWithBrowserPicker() {
    if (!this.canControl) throw new Error("STAGE_OUTPUT_FORBIDDEN");
    try {
      const selected = await stagePadEngine.requestAudioOutput();
      this.preferences.outputDeviceId = selected.deviceId;
      this.preferences.outputLabel = selected.label;
      this.savePreferences();
      this.ready = this.preferences.receiverEnabled;
      this.error = null;
      await this.refreshOutputs();
      await this.publishReceiver();
      this.emit();
      return selected;
    } catch (error) {
      this.testOutputToken = "";
      stagePadEngine.stop(0.12);
      this.ready = false;
      this.error = "AUDIO_OUTPUT_SELECTION_FAILED";
      await this.publishReceiver().catch(() => undefined);
      this.emit();
      throw error;
    }
  }

  async testOutput() {
    if (!this.preferences.receiverEnabled || !this.ready) {
      throw new Error("STAGE_OUTPUT_NOT_READY");
    }
    if (stagePadEngine.isPlaying()) {
      throw new Error("STAGE_OUTPUT_ALREADY_PLAYING");
    }

    const previousVolume = stagePadEngine.getVolume();
    const token = createId();
    this.testOutputToken = token;
    stagePadEngine.setVolume(Math.min(0.28, Math.max(0.14, previousVolume)));
    await stagePadEngine.start("C");
    this.currentKey = "C";
    this.emit();

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (
          this.testOutputToken === token &&
          stagePadEngine.getActiveKey() === "C"
        ) {
          this.testOutputToken = "";
          stagePadEngine.stop(0.32);
          stagePadEngine.setVolume(previousVolume);
          void this.publishReceiver();
          this.emit();
        }
      }, 900);
    }
  }

  async emergencyStop() {
    this.testOutputToken = "";
    stagePadEngine.stop(0.12);
    if (this.preferences.receiverEnabled) {
      await this.publishReceiver().catch(() => undefined);
    }
    this.emit();
  }

  selectTarget(deviceId: string) {
    const receiver = deviceId ? this.selectedRemoteReceiver(deviceId) : null;
    this.preferences.selectedTargetDeviceId = receiver ? deviceId : "";
    if (receiver) {
      this.desiredByTarget.set(deviceId, {
        playing: !!receiver.state?.playing,
        key: receiver.state?.key || null,
        volume: clampStageOutputVolume(
          receiver.state?.volume ?? stagePadEngine.getVolume(),
        ),
      });
    }
    this.savePreferences();
    this.emit();
  }

  private selectedRemoteReceiver(deviceId: string) {
    const receiver = this.snapshot?.receivers?.[deviceId];
    return receiver && isStageReceiverFresh(receiver) ? receiver : null;
  }

  private desiredStateFor(targetDeviceId: string): StageOutputDesiredState {
    const pending = this.desiredByTarget.get(targetDeviceId);
    if (pending) return { ...pending };
    const receiver = this.selectedRemoteReceiver(targetDeviceId);
    return {
      playing: !!receiver?.state?.playing,
      key: receiver?.state?.key || null,
      volume: clampStageOutputVolume(
        receiver?.state?.volume ?? stagePadEngine.getVolume(),
      ),
    };
  }

  private async sendCommand(
    type: StageOutputCommand["type"],
    targetDeviceId: string,
    desired: StageOutputDesiredState,
  ) {
    if (!this.canControl || !this.organizationId || !this.userId) {
      throw new Error("STAGE_OUTPUT_FORBIDDEN");
    }
    const receiver = this.selectedRemoteReceiver(targetDeviceId);
    if (!receiver || (type !== "stop" && !receiver.ready)) {
      throw new Error("STAGE_OUTPUT_NOT_READY");
    }

    const normalizedDesired: StageOutputDesiredState = {
      playing: desired.playing,
      key: desired.key,
      volume: clampStageOutputVolume(desired.volume),
    };
    this.desiredByTarget.set(targetDeviceId, normalizedDesired);

    const command: StageOutputCommand = {
      id: createId(),
      type,
      targetDeviceId,
      actorUserId: this.userId,
      sentAt: Date.now(),
      key: normalizedDesired.key || undefined,
      volume: normalizedDesired.volume,
      desired: normalizedDesired,
    };
    await sendStageOutputCommand(this.organizationId, command);
    return command.id;
  }

  sendPlay(targetDeviceId: string, key: string, volume: number) {
    return this.sendCommand("play", targetDeviceId, {
      playing: true,
      key,
      volume,
    });
  }

  sendStop(targetDeviceId: string) {
    const desired = this.desiredStateFor(targetDeviceId);
    desired.playing = false;
    return this.sendCommand("stop", targetDeviceId, desired);
  }

  sendKey(targetDeviceId: string, key: string) {
    const desired = this.desiredStateFor(targetDeviceId);
    desired.key = key;
    return this.sendCommand("key", targetDeviceId, desired);
  }

  sendVolume(targetDeviceId: string, volume: number) {
    const desired = this.desiredStateFor(targetDeviceId);
    desired.volume = volume;
    return this.sendCommand("volume", targetDeviceId, desired);
  }

  private async handleIncomingCommand(command: StageOutputCommand | null) {
    if (
      !command ||
      command.targetDeviceId !== this.deviceId ||
      command.id === this.lastProcessedCommandId
    ) {
      return;
    }

    this.lastProcessedCommandId = command.id;
    const isStop = command.type === "stop" || command.desired?.playing === false;
    const isStale =
      Date.now() - Number(command.sentAt || 0) > COMMAND_MAX_AGE_MS;

    if (isStale && !isStop) {
      await this.ack(command.id, "STALE_COMMAND");
      return;
    }

    this.testOutputToken = "";

    if (isStop) {
      if (command.desired?.volume !== undefined) {
        stagePadEngine.setVolume(
          clampStageOutputVolume(command.desired.volume),
        );
      }
      if (command.desired?.key) this.currentKey = command.desired.key;
      stagePadEngine.stop(0.18);
      this.error = null;
      await this.ack(command.id, null);
      return;
    }

    if (!this.preferences.receiverEnabled || !this.ready) {
      await this.ack(command.id, "RECEIVER_NOT_READY");
      return;
    }

    try {
      if (command.desired) {
        stagePadEngine.setVolume(
          clampStageOutputVolume(command.desired.volume),
        );
        this.currentKey = command.desired.key || this.currentKey || "C";
        if (command.desired.playing) {
          await stagePadEngine.start(this.currentKey);
        } else {
          stagePadEngine.stop(0.18);
        }
      } else {
        if (command.type === "volume" && command.volume !== undefined) {
          stagePadEngine.setVolume(clampStageOutputVolume(command.volume));
        }
        if (command.type === "key" && command.key) {
          this.currentKey = command.key;
          if (stagePadEngine.isPlaying()) {
            await stagePadEngine.changeKey(command.key);
          }
        }
        if (command.type === "play") {
          if (command.volume !== undefined) {
            stagePadEngine.setVolume(clampStageOutputVolume(command.volume));
          }
          this.currentKey = command.key || this.currentKey || "C";
          await stagePadEngine.start(this.currentKey);
        }
      }
      this.error = null;
      await this.ack(command.id, null);
    } catch {
      stagePadEngine.stop(0.12);
      this.ready = false;
      this.error = "AUDIO_PLAYBACK_FAILED";
      await this.ack(command.id, this.error);
    }
  }

  private async ack(commandId: string, error: string | null) {
    if (!this.organizationId || !this.preferences.receiverEnabled) {
      this.emit();
      return;
    }
    await publishStageReceiverState(
      this.organizationId,
      this.deviceId,
      this.receiverState(commandId, error),
      {
        ready: this.ready,
        outputLabel: this.preferences.outputLabel,
        explicitOutput: !!this.preferences.outputDeviceId,
      },
    ).catch(() => undefined);
    this.error = error;
    this.emit();
  }

  private async handleAudioOutputsChanged() {
    await this.refreshOutputs();
    if (
      !this.preferences.receiverEnabled ||
      !this.preferences.outputDeviceId
    ) {
      return;
    }

    const available = await stagePadEngine.isOutputDeviceAvailable(
      this.preferences.outputDeviceId,
    );
    if (available) return;

    this.testOutputToken = "";
    stagePadEngine.stop(0.12);
    this.ready = false;
    this.error = "OUTPUT_DISCONNECTED";
    await this.publishReceiver().catch(() => undefined);
    this.emit();
  }
}

export const stageOutputCoordinator = new StageOutputCoordinator();
