import {
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export type StageOutputCommandType = "play" | "stop" | "key" | "volume";

export interface StageOutputCommand {
  id: string;
  type: StageOutputCommandType;
  targetDeviceId: string;
  actorUserId: string;
  sentAt: number;
  key?: string;
  volume?: number;
}

export interface StageOutputReceiverState {
  playing: boolean;
  key: string | null;
  volume: number;
  ackCommandId: string | null;
  updatedAt: number;
  error: string | null;
}

export interface StageOutputReceiver {
  deviceId: string;
  ownerUserId: string;
  name: string;
  available: boolean;
  ready: boolean;
  outputLabel: string;
  explicitOutput: boolean;
  lastSeen: number;
  state: StageOutputReceiverState;
}

export interface StageOutputSnapshot {
  organizationId: string;
  receivers: Record<string, StageOutputReceiver>;
  command: StageOutputCommand | null;
  lastUpdated: number;
}

const STAGE_DOCUMENT_PREFIX = "__stage_output__";
export const STAGE_RECEIVER_STALE_MS = 90_000;

const getDocumentId = (organizationId: string) =>
  `${STAGE_DOCUMENT_PREFIX}${organizationId}`;

const getDocumentRef = (organizationId: string) =>
  doc(db, "liveSessions", getDocumentId(organizationId));

const baseDocument = (organizationId: string) => ({
  id: getDocumentId(organizationId),
  scaleId: getDocumentId(organizationId),
  organizationId,
  kind: "stage-output",
  activeSongId: null,
  activeCue: null,
  activeSection: null,
  keyOverrides: {},
  songsOrder: [],
  spontaneousSongs: [],
  mode: "rehearsal",
  leaderId: null,
  stageOutputReceivers: {},
  stageOutputCommand: null,
  lastUpdated: Date.now(),
});

export const isStageReceiverFresh = (
  receiver: StageOutputReceiver,
  now = Date.now(),
) =>
  receiver.available &&
  receiver.lastSeen > 0 &&
  now - receiver.lastSeen <= STAGE_RECEIVER_STALE_MS;

export const clampStageOutputVolume = (value: number) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const subscribeStageOutput = (
  organizationId: string,
  onValue: (value: StageOutputSnapshot | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  if (!organizationId) {
    onValue(null);
    return () => undefined;
  }

  return onSnapshot(
    getDocumentRef(organizationId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onValue(null);
        return;
      }
      const data = snapshot.data() as any;
      onValue({
        organizationId: data.organizationId || organizationId,
        receivers: data.stageOutputReceivers || {},
        command: data.stageOutputCommand || null,
        lastUpdated: Number(data.lastUpdated || 0),
      });
    },
    (error) => onError?.(error as Error),
  );
};

export const ensureStageOutputDocument = async (organizationId: string) => {
  if (!organizationId) throw new Error("STAGE_OUTPUT_ORGANIZATION_REQUIRED");
  await setDoc(getDocumentRef(organizationId), baseDocument(organizationId), {
    merge: true,
  });
};

export const publishStageReceiver = async (
  organizationId: string,
  receiver: StageOutputReceiver,
) => {
  await ensureStageOutputDocument(organizationId);
  await updateDoc(getDocumentRef(organizationId), {
    [`stageOutputReceivers.${receiver.deviceId}`]: receiver,
    lastUpdated: Date.now(),
  });
};

export const removeStageReceiver = async (
  organizationId: string,
  deviceId: string,
) => {
  if (!organizationId || !deviceId) return;
  await updateDoc(getDocumentRef(organizationId), {
    [`stageOutputReceivers.${deviceId}`]: deleteField(),
    lastUpdated: Date.now(),
  });
};

export const publishStageReceiverState = async (
  organizationId: string,
  deviceId: string,
  state: StageOutputReceiverState,
  readiness?: Pick<StageOutputReceiver, "ready" | "outputLabel" | "explicitOutput">,
) => {
  const patch: Record<string, unknown> = {
    [`stageOutputReceivers.${deviceId}.state`]: state,
    [`stageOutputReceivers.${deviceId}.lastSeen`]: Date.now(),
    lastUpdated: Date.now(),
  };
  if (readiness) {
    patch[`stageOutputReceivers.${deviceId}.ready`] = readiness.ready;
    patch[`stageOutputReceivers.${deviceId}.outputLabel`] = readiness.outputLabel;
    patch[`stageOutputReceivers.${deviceId}.explicitOutput`] = readiness.explicitOutput;
  }
  await updateDoc(getDocumentRef(organizationId), patch);
};

export const sendStageOutputCommand = async (
  organizationId: string,
  command: StageOutputCommand,
) => {
  await ensureStageOutputDocument(organizationId);
  await updateDoc(getDocumentRef(organizationId), {
    stageOutputCommand: command,
    lastUpdated: Date.now(),
  });
};
