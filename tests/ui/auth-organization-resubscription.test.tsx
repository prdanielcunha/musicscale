import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  organizationId: 'org-a',
  unsubscribes: [] as ReturnType<typeof vi.fn>[],
  fetchEntitlements: vi.fn(async (organizationId: string) => ({
    organizationId,
    plan: 'starter',
    status: 'active',
    limits: {},
    features: {},
  })),
}));

vi.mock('../../contexts/EcosystemContext', () => ({
  useEcosystem: () => ({
    isInitialized: true,
    context: {
      currentOrganizationId: mocks.organizationId,
      currentOrganizationName: mocks.organizationId,
      roleInCurrentOrganization: 'member',
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

import { onSnapshot } from 'firebase/firestore';
import { AuthProvider } from '../../contexts/AuthContext';

afterEach(() => {
  cleanup();
  mocks.organizationId = 'org-a';
  mocks.unsubscribes = [];
  mocks.fetchEntitlements.mockClear();
});

describe('AuthContext tenant reaction', () => {
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
});
