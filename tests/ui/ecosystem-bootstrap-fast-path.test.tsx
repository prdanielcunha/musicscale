import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authCallback: null as null | ((user: any) => void),
  currentUser: null as any,
  profiles: new Map<string, any>(),
  organizations: new Map<string, any>(),
  discoveryPromise: Promise.resolve({ docs: [] }) as Promise<any>,
}));

vi.mock('../../services/ecosystem/EcosystemBridge', () => ({
  ecosystemBridge: {
    initialize: vi.fn(async () => ({
      uid: '',
      currentOrganizationId: '',
      organizationsAvailable: [],
      permissions: {},
      isStandalone: true,
    })),
    publishEvent: vi.fn(),
    navigateToEcosystem: vi.fn(),
  },
}));

vi.mock('../../services/ecosystem/handoffHelper', () => ({ consumeHandoff: vi.fn(async () => undefined) }));

vi.mock('../../services/firebase', () => ({
  auth: {
    get currentUser() { return mocks.currentUser; },
    signOut: vi.fn(),
  },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    mocks.authCallback = callback;
    return vi.fn();
  }),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...segments: string[]) => segments.join('/')),
  collection: vi.fn((_db, ...segments: string[]) => segments.join('/')),
  collectionGroup: vi.fn((_db, name: string) => `group:${name}`),
  where: vi.fn((...args: any[]) => args),
  query: vi.fn((ref: any) => ref),
  getDocs: vi.fn(() => mocks.discoveryPromise),
  getDoc: vi.fn(async (path: string) => {
    const segments = path.split('/');
    const data = segments[0] === 'users'
      ? mocks.profiles.get(segments[1])
      : segments[0] === 'organizations' && segments.length === 2
        ? mocks.organizations.get(segments[1])
        : undefined;
    return { exists: () => Boolean(data), data: () => data };
  }),
}));

import { EcosystemProvider, useEcosystem } from '../../contexts/EcosystemContext';

let latestEcosystem: ReturnType<typeof useEcosystem>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

function canonical(uid: string, organizationId: string, capabilities: string[] = []) {
  return {
    success: true,
    userId: uid,
    organizationId,
    organizationRole: capabilities.length ? 'admin' : 'member',
    membershipStatus: 'active',
    effectiveContext: {
      userId: uid,
      organizationId,
      organizationRole: capabilities.length ? 'admin' : 'member',
      membershipStatus: 'active',
      isGlobalAccess: false,
      isGlobalFullAccess: false,
      isOrganizationFullAccess: capabilities.length > 0,
      effectiveCapabilities: capabilities,
      resolutionStatus: 'resolved',
    },
  };
}

const response = (body: any, ok = true) => Promise.resolve({ ok, json: async () => body } as Response);

function Probe() {
  const value = useEcosystem();
  latestEcosystem = value;
  return <pre data-testid="context">{JSON.stringify(value)}</pre>;
}

async function startUser(uid: string) {
  const user = { uid, email: `${uid}@test.dev`, displayName: uid, getIdToken: vi.fn(async () => `token-${uid}`) };
  mocks.currentUser = user;
  await act(async () => { mocks.authCallback?.(user); });
}

beforeEach(async () => {
  localStorage.clear();
  mocks.authCallback = null;
  mocks.currentUser = null;
  mocks.profiles.clear();
  mocks.organizations.clear();
  mocks.discoveryPromise = Promise.resolve({ docs: [] });
  vi.stubGlobal('fetch', vi.fn());
  render(<EcosystemProvider><Probe /></EcosystemProvider>);
  await waitFor(() => expect(mocks.authCallback).toBeTypeOf('function'));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EcosystemProvider canonical bootstrap fast path', () => {
  it('releases canonical context while broad discovery remains unresolved', async () => {
    mocks.profiles.set('user-1', { activeOrganizationId: 'org-1', organizationRole: 'owner' });
    mocks.organizations.set('org-1', { name: 'Organization One' });
    mocks.discoveryPromise = new Promise(() => {});
    vi.mocked(fetch).mockImplementation(() => response(canonical('user-1', 'org-1')));

    await startUser('user-1');

    const rendered = await screen.findByTestId('context');
    await waitFor(() => expect(rendered.textContent).toContain('"currentOrganizationId":"org-1"'));
    expect(rendered.textContent).toContain('"isInitialized":true');
    expect(rendered.textContent).toContain('"isContextSyncing":false');
    expect(rendered.textContent).toContain('"canManageRepertoire":false');
    expect(rendered.textContent).toContain('"canManageChords":false');
    expect(rendered.textContent).toContain('"canManageScales":false');
  });

  it('does not release mismatched canonical identity or cached chord management permissions', async () => {
    localStorage.setItem('musicscale_cached_context_user-1', JSON.stringify({
      uid: 'user-1', currentOrganizationId: 'org-1', permissions: {
        canManageOrganization: true,
        canManageChords: true,
      },
    }));
    mocks.profiles.set('user-1', { activeOrganizationId: 'org-1', organizationRole: 'owner' });
    mocks.discoveryPromise = new Promise(() => {});
    vi.mocked(fetch).mockImplementation(() => response(canonical('different-user', 'org-1', ['organization.settings.manage'])));

    await startUser('user-1');

    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('context')).not.toBeInTheDocument();
  });

  it('ignores a canonical response from an obsolete auth generation', async () => {
    const oldCanonical = deferred<Response>();
    mocks.profiles.set('old-user', { activeOrganizationId: 'old-org' });
    mocks.profiles.set('new-user', { activeOrganizationId: 'new-org' });
    mocks.discoveryPromise = new Promise(() => {});
    vi.mocked(fetch).mockImplementation((url) => String(url).includes('old-org')
      ? oldCanonical.promise
      : response(canonical('new-user', 'new-org')));

    await startUser('old-user');
    await startUser('new-user');
    await waitFor(() => expect(screen.getByTestId('context').textContent).toContain('new-org'));

    await act(async () => { oldCanonical.resolve(await response(canonical('old-user', 'old-org'))); });
    expect(screen.getByTestId('context').textContent).toContain('new-org');
    expect(screen.getByTestId('context').textContent).not.toContain('old-org');
  });

  it('derives permissions from canonical capabilities and enriches discovery without switching tenant', async () => {
    const discovery = deferred<any>();
    mocks.profiles.set('user-1', { activeOrganizationId: 'org-1', organizationRole: 'member' });
    mocks.organizations.set('org-1', { name: 'Organization One', plan: 'pro' });
    mocks.discoveryPromise = discovery.promise;
    vi.mocked(fetch).mockImplementation(() => response(canonical('user-1', 'org-1', [
      'organization.settings.manage', 'organization.members.manage',
      'scales.create', 'scales.update', 'songs.create', 'songs.update',
    ])));

    await startUser('user-1');
    await waitFor(() => expect(screen.getByTestId('context').textContent).toContain('"canManageOrganization":true'));
    expect(screen.getByTestId('context').textContent).toContain('"canManageRepertoire":true');
    expect(screen.getByTestId('context').textContent).toContain('"canManageChords":true');

    await act(async () => { discovery.resolve({ docs: [] }); });
    await waitFor(() => expect(screen.getByTestId('context').textContent).toContain('Organization One'));
    expect(screen.getByTestId('context').textContent).toContain('"currentOrganizationId":"org-1"');
  });

  it('keeps the secure degraded fallback when canonical access fails', async () => {
    mocks.profiles.set('user-1', { activeOrganizationId: 'org-1', organizationRole: 'owner' });
    mocks.organizations.set('org-1', { name: 'Organization One' });
    vi.mocked(fetch).mockImplementation(() => response({}, false));

    await startUser('user-1');

    await waitFor(() => expect(screen.getByTestId('context').textContent).toContain('"isDegraded":true'));
    expect(screen.getByTestId('context').textContent).toContain('"canManageOrganization":false');
  });
});

describe('EcosystemProvider canonical organization switching', () => {
  async function bootstrap(capabilities: string[] = []) {
    mocks.profiles.set('user-1', { activeOrganizationId: 'org-a', organizationRole: 'admin' });
    mocks.organizations.set('org-a', { name: 'Organization A' });
    vi.mocked(fetch).mockImplementation(() => response(canonical('user-1', 'org-a', capabilities)));
    localStorage.setItem('activeOrganizationId', 'org-a');
    await startUser('user-1');
    await waitFor(() => expect(latestEcosystem.context?.currentOrganizationId).toBe('org-a'));
  }

  it('commits a valid canonical switch without an early local preference write or reload', async () => {
    await bootstrap(['songs.create', 'songs.update']);
    const target = deferred<Response>();
    vi.mocked(fetch).mockImplementation(() => target.promise);

    let switching!: Promise<boolean>;
    act(() => { switching = latestEcosystem.switchOrganization('org-b'); });
    expect(latestEcosystem.context?.currentOrganizationId).toBe('org-a');
    expect(localStorage.getItem('activeOrganizationId')).toBe('org-a');

    await act(async () => {
      target.resolve(await response(canonical('user-1', 'org-b')));
      expect(await switching).toBe(true);
    });
    expect(latestEcosystem.context?.currentOrganizationId).toBe('org-b');
    expect(latestEcosystem.context?.permissions.canManageRepertoire).toBe(false);
    expect(latestEcosystem.context?.permissions.canManageChords).toBe(false);
    expect(localStorage.getItem('activeOrganizationId')).toBe('org-b');
    expect(latestEcosystem.context?.isStandalone).toBe(true);
  });

  it.each([
    ['mismatched identity', canonical('other-user', 'org-b')],
    ['pending membership', { ...canonical('user-1', 'org-b'), membershipStatus: 'pending', effectiveContext: { ...canonical('user-1', 'org-b').effectiveContext, membershipStatus: 'pending' } }],
  ])('rejects %s without changing tenant or permissions', async (_label, body) => {
    await bootstrap(['songs.create', 'songs.update']);
    vi.mocked(fetch).mockImplementation(() => response(body));
    await act(async () => { expect(await latestEcosystem.switchOrganization('org-b')).toBe(false); });
    expect(latestEcosystem.context?.currentOrganizationId).toBe('org-a');
    expect(latestEcosystem.context?.permissions.canManageRepertoire).toBe(true);
    expect(localStorage.getItem('activeOrganizationId')).toBe('org-a');
  });

  it('upgrades permissions only from the target canonical capabilities', async () => {
    await bootstrap();
    vi.mocked(fetch).mockImplementation(() => response(canonical('user-1', 'org-b', [
      'organization.settings.manage', 'organization.members.manage',
      'scales.create', 'scales.update', 'songs.create', 'songs.update',
    ])));
    await act(async () => { expect(await latestEcosystem.switchOrganization('org-b')).toBe(true); });
    expect(latestEcosystem.context?.permissions).toMatchObject({
      canManageOrganization: true,
      canManageMembers: true,
      canManageScales: true,
      canManageRepertoire: true,
      canManageChords: true,
    });
  });

  it('prevents a slow obsolete switch from overwriting a newer tenant', async () => {
    await bootstrap();
    const slowB = deferred<Response>();
    vi.mocked(fetch).mockImplementation(url => String(url).includes('org-b')
      ? slowB.promise
      : response(canonical('user-1', 'org-c')));

    let switchB!: Promise<boolean>;
    act(() => { switchB = latestEcosystem.switchOrganization('org-b'); });
    await act(async () => { expect(await latestEcosystem.switchOrganization('org-c')).toBe(true); });
    await act(async () => {
      slowB.resolve(await response(canonical('user-1', 'org-b')));
      expect(await switchB).toBe(false);
    });
    expect(latestEcosystem.context?.currentOrganizationId).toBe('org-c');
    expect(localStorage.getItem('activeOrganizationId')).toBe('org-c');
  });

  it('invalidates a pending switch when authentication changes', async () => {
    await bootstrap();
    const pending = deferred<Response>();
    vi.mocked(fetch).mockImplementation(() => pending.promise);
    let switching!: Promise<boolean>;
    act(() => { switching = latestEcosystem.switchOrganization('org-b'); });
    mocks.currentUser = null;
    await act(async () => {
      pending.resolve(await response(canonical('user-1', 'org-b')));
      expect(await switching).toBe(false);
    });
    expect(latestEcosystem.context?.currentOrganizationId).toBe('org-a');
    expect(localStorage.getItem('activeOrganizationId')).toBe('org-a');
  });
});
