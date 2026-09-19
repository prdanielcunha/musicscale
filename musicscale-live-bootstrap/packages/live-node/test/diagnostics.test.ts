import { describe, expect, it } from 'vitest';
import { buildLiveNodeDiagnostics } from '../src/diagnostics';

describe('Live Node diagnostics', () => {
  it('exports operational state without provider secrets', () => {
    const snapshot = buildLiveNodeDiagnostics({
      nodeId: 'node_1',
      version: '0.1.0-alpha.1',
      hostname: 'production-pc',
      platform: 'win32',
      arch: 'x64',
      nodeVersion: 'v24.0.0',
      port: 4317,
      lanAddresses: ['192.168.1.20'],
      webAppPresent: true,
      pairingEnabled: true,
      pairedDevices: 2,
      runtime: {
        revision: 4,
        nodeId: 'node_1',
        updatedAt: '2026-09-18T18:00:00.000Z',
        activeLiveSessionId: 'service-plan:plan_1',
        activeServiceItemId: 'song:s1',
        providerObservedState: {},
        servicePlan: null,
        providerLinks: [],
        requests: [],
        scenes: []
      },
      providers: [{
        providerId: 'holyrics-primary',
        health: 'online',
        capabilities: ['songs.present']
      }],
      holyrics: {
        configured: true,
        source: 'local',
        baseUrl: 'http://127.0.0.1:8091'
      },
      resolume: {
        configured: true,
        source: 'local',
        baseUrl: 'http://127.0.0.1:8080'
      },
      propresenter: {
        configured: true,
        source: 'local',
        baseUrl: 'http://192.168.1.44:1025'
      }
    });

    expect(snapshot.providers[0]?.health).toBe('online');
    expect(snapshot.security.providerSecretsIncluded).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('token');
    expect(JSON.stringify(snapshot)).not.toContain('secret');
  });
});
