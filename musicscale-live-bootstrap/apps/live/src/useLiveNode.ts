import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LiveNodeConnectionState,
  LiveNodeHealth,
  PairingChallenge,
  PairingScope
} from '@musicscale-live/domain';
import {
  clearLiveNodeCredential,
  loadLiveNodeCredential,
  saveLiveNodeCredential,
  type StoredLiveNodeCredential
} from './credentialStore';
import { defaultDeviceName, getOrCreateDeviceId } from './deviceIdentity';
import {
  completePairing,
  heartbeatNode,
  probeNode,
  requestPairing,
  revokeNodePairing,
  type LiveNodeApiError
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
      const nextHealth = await probeNode(value.baseUrl);
      failures.current = 0;
      setHealth(nextHealth);
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
    scope: PairingScope,
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
      const challenge = await requestPairing(baseUrl, {
        ...scope,
        deviceId,
        deviceName
      });
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
    setState('unconfigured');
    setErrorCode(null);
    failures.current = 0;
  }, [credential]);

  return {
    state,
    health,
    credential,
    pending,
    errorCode,
    beginPairing,
    finishPairing,
    disconnect
  };
}
