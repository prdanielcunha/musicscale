import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  organization: null as any,
  subscription: null as any,
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  user: { uid: 'user-1', email: 'member@example.test' },
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
    authState.organization = null;
    authState.subscription = null;
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
