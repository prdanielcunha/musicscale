import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Capability,
  CommandOrigin,
  CommandResult,
  LiveNodeConnectionState,
  LiveNodeHealth,
  LiveCommand,
  LiveRequest,
  PairingChallenge,
  PairingRequest,
  PairingScope,
  ProviderLink,
  Scene,
  SafetyLevel,
  Scene,
  SceneExecutionResult,
  ServicePlan
} from '@musicscale-live/domain';
import {
  clearLiveNodeCredential,
  loadLiveNodeCredential,
  saveLiveNodeCredential,
  type StoredLiveNodeCredential
} from './credentialStore';
import { defaultDeviceName, getOrCreateDeviceId } from './deviceIdentity';
import {
  cacheNodeServicePlan,
  cacheNodeScenes,
  completePairing,
  executeNodeCommand,
  executeNodeScene,
  fetchProviderOutputSnapshot,
  heartbeatNode,
  loadNodeState,
  probeNode,
  requestPairing,
  revokeNodePairing,
  submitNodeLiveRequest,
  updateNodeLiveRequestStatus,
  type LiveNodeApiError,
  type LiveNodeStateResponse
} from './liveNodeClient';
import { transportBroker } from './transportBroker';

interface PendingPairing {
  baseUrl: string;
  transportKind: 'direct-lan' | 'local-console' | 'cloud-relay';
  challenge: PairingChallenge;
  deviceId: string;
  deviceName: string;
}

export function useLiveNode() {
  const [state, setState] = useState<LiveNodeConnectionState>('unconfigured');
  const [health, setHealth] = useState<LiveNodeHealth | null>(null);
  const [credential, setCredential] = useState<StoredLiveNodeCredential | null>(null);
  const [nodeState, setNodeState] = useState<LiveNodeStateResponse | null>(null);
  const [pending, setPending] = useState<PendingPairing | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const failures = useRef(0);

  const markError = useCallback((error: unknown, fallback: LiveNodeConnectionState) => {
    failures.current += 1;
    setState(failures.current >= 2 ? 'reconnecting' : fallback);
    setErrorCode((error as LiveNodeApiError)?.code || (error instanceof Error ? error.message : 'node_unreachable'));
  }, []);

  const heartbeat = useCallback(async (value: StoredLiveNodeCredential) => {
    try {
      await heartbeatNode(value.baseUrl, value.token);
      const [nextHealth, nextState] = await Promise.all([
        probeNode(value.baseUrl),
        loadNodeState(value.baseUrl, value.token)
      ]);
      failures.current = 0;
      setHealth(nextHealth);
      setNodeState(nextState);
      setState('connected');
      setErrorCode(null);
      return true;
    } catch (error) {
      markError(error, 'degraded');
      return false;
    }
  }, [markError]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    (async () => {
      const stored = await loadLiveNodeCredential().catch(() => null);
      if (cancelled || !stored) return;

      setCredential(stored);
      setState('probing');
      await heartbeat(stored);

      const tick = async () => {
        if (cancelled) return;
        await heartbeat(stored);
        const delay = failures.current > 0
          ? Math.min(30_000, 2_000 * Math.pow(2, Math.min(4, failures.current)))
          : 5_000;
        timer = window.setTimeout(tick, delay);
      };
      timer = window.setTimeout(tick, 5_000);
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [heartbeat]);

  const beginPairing = useCallback(async (
    baseUrlInput: string,
    scope?: PairingScope,
    requestedDeviceName?: string
  ) => {
    setState('probing');
    setErrorCode(null);
    try {
      const transport = transportBroker.resolve(baseUrlInput);
      const baseUrl = transport.baseUrl;

      const nextHealth = await probeNode(baseUrl);
      setHealth(nextHealth);
      const deviceId = getOrCreateDeviceId();
      const deviceName = requestedDeviceName?.trim() || defaultDeviceName();

      setState('pairing');
      const pairingRequest: PairingRequest = {
        deviceId,
        deviceName,
        ...(scope || {})
      };
      const challenge = await requestPairing(baseUrl, pairingRequest);
      const value = { baseUrl, challenge, deviceId, deviceName, transportKind: transport.kind };
      setPending(value);
      return value;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'mixed_content_blocked') {
        setState('blocked');
        setErrorCode(code);
        return null;
      }
      markError(error, 'offline');
      return null;
    }
  }, [markError]);

  const finishPairing = useCallback(async (pin: string) => {
    if (!pending) return false;
    setErrorCode(null);
    try {
      const completed = await completePairing(pending.baseUrl, {
        challengeId: pending.challenge.challengeId,
        pin: pin.replace(/\D/g, '').slice(0, 6),
        deviceId: pending.deviceId,
        deviceName: pending.deviceName
      });
      const nextCredential: StoredLiveNodeCredential = {
        baseUrl: pending.baseUrl,
        transportKind: pending.transportKind,
        token: completed.token,
        binding: completed.binding
      };
      await saveLiveNodeCredential(nextCredential);
      setCredential(nextCredential);
      setPending(null);
      failures.current = 0;
      await heartbeat(nextCredential);
      return true;
    } catch (error) {
      setState('pairing');
      setErrorCode((error as LiveNodeApiError)?.code || 'pairing_failed');
      return false;
    }
  }, [heartbeat, pending]);

  const refreshState = useCallback(async () => {
    if (!credential) throw new Error('node_not_paired');
    const refreshed = await loadNodeState(credential.baseUrl, credential.token);
    setNodeState(refreshed);
    return refreshed;
  }, [credential]);

  const submitRequest = useCallback(async (input: {
    liveSessionId: string;
    actorId: string;
    kind: LiveRequest['kind'];
    payload: Record<string, unknown>;
  }) => {
    if (!credential) throw new Error('node_not_paired');

    const request: LiveRequest = {
      id: crypto.randomUUID(),
      organizationId: credential.binding.organizationId,
      venueId: credential.binding.venueId,
      liveSessionId: input.liveSessionId,
      actorId: input.actorId,
      kind: input.kind,
      payload: input.payload,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await submitNodeLiveRequest(credential.baseUrl, credential.token, request);
    await refreshState();
    return request;
  }, [credential, refreshState]);

  const updateRequestStatus = useCallback(async (
    requestId: string,
    status: 'accepted' | 'rejected' | 'completed',
    resolvedBy: string
  ) => {
    if (!credential) throw new Error('node_not_paired');
    const response = await updateNodeLiveRequestStatus(
      credential.baseUrl,
      credential.token,
      requestId,
      status,
      resolvedBy
    );
    await refreshState();
    return response.request;
  }, [credential, refreshState]);

  const executeCommand = useCallback(async (input: {
    capability: Capability;
    payload?: Record<string, unknown>;
    liveSessionId: string;
    serviceItemId?: string;
    actorId: string;
    origin?: CommandOrigin;
    outputTargets?: string[];
    targetProviderIds?: string[];
    safetyLevel?: SafetyLevel;
    confirmed?: boolean;
  }): Promise<CommandResult[]> => {
    if (!credential) throw new Error('node_not_paired');

    const id = crypto.randomUUID();
    const command: LiveCommand = {
      id,
      correlationId: crypto.randomUUID(),
      organizationId: credential.binding.organizationId,
      venueId: credential.binding.venueId,
      liveSystemId: credential.binding.liveSystemId,
      liveSessionId: input.liveSessionId,
      serviceItemId: input.serviceItemId,
      actorId: input.actorId,
      origin: input.origin || 'live-ui',
      capability: input.capability,
      targetProviderIds: input.targetProviderIds || [],
      outputTargets: input.outputTargets || ['main'],
      payload: input.payload || {},
      idempotencyKey: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      safetyLevel: input.safetyLevel || 'normal'
    };

    const response = await executeNodeCommand(
      credential.baseUrl,
      credential.token,
      command,
      input.confirmed === true
    );
    const refreshed = await loadNodeState(
      credential.baseUrl,
      credential.token
    ).catch(() => null);
    if (refreshed) setNodeState(refreshed);
    return response.results;
  }, [credential]);

  const executeScene = useCallback(async (input: {
    scene: Scene;
    liveSessionId: string;
    serviceItemId?: string;
    actorId: string;
    origin?: CommandOrigin;
    confirmed?: boolean;
  }): Promise<SceneExecutionResult> => {
    if (!credential) throw new Error('node_not_paired');

    const requestId = crypto.randomUUID();
    const result = await executeNodeScene(
      credential.baseUrl,
      credential.token,
      {
        id: requestId,
        correlationId: crypto.randomUUID(),
        organizationId: credential.binding.organizationId,
        venueId: credential.binding.venueId,
        liveSystemId: credential.binding.liveSystemId,
        liveSessionId: input.liveSessionId,
        serviceItemId: input.serviceItemId,
        actorId: input.actorId,
        origin: input.origin || 'live-ui',
        scene: input.scene,
        idempotencyKey: crypto.randomUUID()
      },
      input.confirmed === true
    );

    const refreshed = await loadNodeState(
      credential.baseUrl,
      credential.token
    ).catch(() => null);
    if (refreshed) setNodeState(refreshed);
    return result;
  }, [credential]);

  const fetchOutputSnapshot = useCallback(async (
    providerId: string,
    targetId: string,
    format: 'jpeg' | 'png' = 'jpeg'
  ): Promise<Blob> => {
    if (!credential) throw new Error('node_not_paired');
    return fetchProviderOutputSnapshot(
      credential.baseUrl,
      credential.token,
      providerId,
      targetId,
      format
    );
  }, [credential]);

  const cacheServicePlan = useCallback(async (
    plan: ServicePlan,
    providerLinks: ProviderLink[] = []
  ) => {
    if (!credential) throw new Error('node_not_paired');
    await cacheNodeServicePlan(
      credential.baseUrl,
      credential.token,
      plan,
      providerLinks
    );
    const refreshed = await loadNodeState(
      credential.baseUrl,
      credential.token
    );
    setNodeState(refreshed);
    return refreshed;
  }, [credential]);

  const cacheScenes = useCallback(async (scenes: Scene[]) => {
    if (!credential) throw new Error('node_not_paired');
    await cacheNodeScenes(credential.baseUrl, credential.token, scenes);
    const refreshed = await loadNodeState(credential.baseUrl, credential.token);
    setNodeState(refreshed);
    return refreshed;
  }, [credential]);

  const disconnect = useCallback(async () => {
    const current = credential;
    if (current) {
      await revokeNodePairing(
        current.baseUrl,
        current.token,
        current.binding.deviceId
      ).catch(() => {});
    }
    await clearLiveNodeCredential();
    setCredential(null);
    setPending(null);
    setHealth(null);
    setNodeState(null);
    setState('unconfigured');
    setErrorCode(null);
    failures.current = 0;
  }, [credential]);

  return {
    state,
    health,
    credential,
    nodeState,
    pending,
    errorCode,
    beginPairing,
    finishPairing,
    executeCommand,
    executeScene,
    fetchOutputSnapshot,
    cacheServicePlan,
    refreshState,
    submitRequest,
    updateRequestStatus,
    cacheScenes,
    disconnect
  };
}
