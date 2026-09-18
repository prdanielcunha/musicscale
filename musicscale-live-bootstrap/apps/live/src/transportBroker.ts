import type { LiveNodeTransportKind } from '@musicscale-live/domain';
import {
  mixedContentWouldBlock,
  normalizePrivateNodeUrl
} from './liveNodeClient';

export interface ResolvedLiveNodeTransport {
  kind: LiveNodeTransportKind;
  baseUrl: string;
}

export class TransportBroker {
  resolve(baseUrlInput: string): ResolvedLiveNodeTransport {
    const baseUrl = normalizePrivateNodeUrl(baseUrlInput);

    if (new URL(baseUrl).origin === window.location.origin) {
      return { kind: 'local-console', baseUrl };
    }

    if (mixedContentWouldBlock(baseUrl)) {
      throw new Error('mixed_content_blocked');
    }

    return { kind: 'direct-lan', baseUrl };
  }

  cloudRelay(): never {
    throw new Error('cloud_relay_disabled');
  }
}

export const transportBroker = new TransportBroker();
