import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: { uid: 'user-1', email: 'member@example.test' } as any,
  organization: null as any,
  subscription: null as any,
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  user: authState.user,
  userProfile: { products: ['musicscale'] },
  loading: false,
  organization: authState.organization,
  subscription: authState.subscription,
  isSubscriptionLoaded: true,
  entitlements: authState.subscription ? { status: authState.subscription.status } : null,
  isEntitlementsLoaded: true,
  isGlobalAdmin: false,
  needsRepair: false,
}) }));
vi.mock('../../contexts/EcosystemContext', () => ({ useEcosystem: () => ({ context: null }) }));
vi.mock('../../pages/TenantOnboarding', () => ({ default: () => <div>lazy-tenant-onboarding</div> }));

import StartGateway from '../../pages/StartGateway';

describe('StartGateway onboarding boundary', () => {
  beforeEach(() => {
    authState.user = { uid: 'user-1', email: 'member@example.test' };
    authState.organization = null;
    authState.subscription = null;
  });

  it('opens native login when direct entry has no session', async () => {
    authState.user = null;
    render(<MemoryRouter initialEntries={['/start']}><Routes>
      <Route path="/start" element={<StartGateway />} />
      <Route path="/login" element={<div>native-login</div>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('native-login')).toBeInTheDocument();
  });

  it('renders the no-organization experience through its lazy boundary', async () => {
    render(<StartGateway />);
    expect(await screen.findByText('lazy-tenant-onboarding')).toBeInTheDocument();
  });

  it('requires profile completion for a Hub bootstrap workspace after access is active', async () => {
    authState.organization = {
      id: 'org-bootstrap',
      name: 'My Workspace',
      slug: 'org-bootstrap',
      onboardingState: 'pending_profile',
    };
    authState.subscription = { status: 'trialing', plan: 'pro' };

    render(<StartGateway />);
    expect(await screen.findByText('lazy-tenant-onboarding')).toBeInTheDocument();
  });
});
