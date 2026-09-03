import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  organizationId: 'org-a',
  ecosystemRole: 'user',
  entitlementsByOrganization: new Map<string, Promise<any>>(),
  unsubscribes: [] as ReturnType<typeof vi.fn>[],
  fetchEntitlements: vi.fn((organizationId: string) => mocks.entitlementsByOrganization.get(organizationId)
    || Promise.resolve(entitlement(organizationId, 'starter'))),
}));

function entitlement(organizationId: string, plan: 'starter' | 'pro') {
  return {
    organizationId, plan, status: 'active', limits: {},
    features: { libraryAccess: plan === 'pro' },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => { resolve = resolver; });
  return { promise, resolve };
}

vi.mock('../../contexts/EcosystemContext', () => ({
  useEcosystem: () => ({
    isInitialized: true,
    context: {
      currentOrganizationId: mocks.organizationId,
      currentOrganizationName: mocks.organizationId,
      ecosystemRole: mocks.ecosystemRole,
      roleInCurrentOrganization: 'member',
      plan: 'starter',
      permissions: {},
    },
  }),
}));

vi.mock('../../services/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn(() => vi.fn()) }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...segments: string[]) => segments.join('/')),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(() => {
    const unsubscribe = vi.fn();
    mocks.unsubscribes.push(unsubscribe);
    return unsubscribe;
  }),
}));
vi.mock('../../services/authService', () => ({ signOutUser: vi.fn() }));
vi.mock('../../services/entitlementsService', () => ({
  entitlementsService: {
    fetchEntitlements: mocks.fetchEntitlements,
    invalidateOrganizationCache: vi.fn(),
  },
}));

import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider, useFeatures } from '../../contexts/AuthContext';

function FeatureProbe() {
  const features = useFeatures();
  return <div data-testid="plan">{features.effectivePlan}</div>;
}

afterEach(() => {
  cleanup();
  mocks.organizationId = 'org-a';
  mocks.ecosystemRole = 'user';
  mocks.unsubscribes = [];
  mocks.entitlementsByOrganization.clear();
  mocks.fetchEntitlements.mockClear();
  vi.mocked(onAuthStateChanged).mockClear();
  vi.mocked(onSnapshot).mockClear();
});

describe('AuthContext tenant reaction', () => {
  it('does not resubscribe Firebase Auth when ecosystem metadata enriches without an identity change', async () => {
    const rendered = render(<AuthProvider><div>app</div></AuthProvider>);
    await waitFor(() => expect(vi.mocked(onAuthStateChanged)).toHaveBeenCalledTimes(1));

    mocks.ecosystemRole = 'global_admin';
    rendered.rerender(<AuthProvider><div>app</div></AuthProvider>);

    await Promise.resolve();
    expect(vi.mocked(onAuthStateChanged)).toHaveBeenCalledTimes(1);
  });

  it('replaces organization and subscription listeners and refetches entitlements', async () => {
    const rendered = render(<AuthProvider><div>app</div></AuthProvider>);
    await waitFor(() => expect(vi.mocked(onSnapshot)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(onSnapshot).mock.calls.map(call => call[0])).toEqual([
      'organizations/org-a', 'subscriptions/org-a',
    ]);
    expect(mocks.fetchEntitlements).toHaveBeenCalledWith('org-a');

    const previousUnsubscribes = [...mocks.unsubscribes];
    mocks.organizationId = 'org-b';
    rendered.rerender(<AuthProvider><div>app</div></AuthProvider>);

    await waitFor(() => expect(vi.mocked(onSnapshot)).toHaveBeenCalledTimes(4));
    expect(previousUnsubscribes.every(unsubscribe => unsubscribe.mock.calls.length === 1)).toBe(true);
    expect(vi.mocked(onSnapshot).mock.calls.slice(2).map(call => call[0])).toEqual([
      'organizations/org-b', 'subscriptions/org-b',
    ]);
    expect(mocks.fetchEntitlements).toHaveBeenCalledWith('org-b');
  });

  it('isolates a Pro tenant immediately and hydrates the target Starter plan', async () => {
    mocks.entitlementsByOrganization.set('org-a', Promise.resolve(entitlement('org-a', 'pro')));
    const target = deferred<any>();
    mocks.entitlementsByOrganization.set('org-b', target.promise);
    const rendered = render(<AuthProvider><FeatureProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('plan')).toHaveTextContent('pro'));

    mocks.organizationId = 'org-b';
    rendered.rerender(<AuthProvider><FeatureProbe /></AuthProvider>);
    expect(screen.getByTestId('plan')).toHaveTextContent('starter');

    target.resolve(entitlement('org-b', 'starter'));
    await waitFor(() => expect(screen.getByTestId('plan')).toHaveTextContent('starter'));
  });

  it('hydrates the target Pro plan ahead of neutral ecosystem fallback state', async () => {
    const target = deferred<any>();
    mocks.entitlementsByOrganization.set('org-b', target.promise);
    mocks.organizationId = 'org-b';
    render(<AuthProvider><FeatureProbe /></AuthProvider>);
    expect(screen.getByTestId('plan')).toHaveTextContent('starter');

    target.resolve(entitlement('org-b', 'pro'));
    await waitFor(() => expect(screen.getByTestId('plan')).toHaveTextContent('pro'));
  });
});
