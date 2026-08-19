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
  });

  it('does not release mismatched canonical identity or cached management permissions', async () => {
    localStorage.setItem('musicscale_cached_context_user-1', JSON.stringify({
      uid: 'user-1', currentOrganizationId: 'org-1', permissions: { canManageOrganization: true },
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
