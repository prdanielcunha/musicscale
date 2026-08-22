import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  user: { uid: 'user-1', email: 'member@example.test' }, userProfile: { products: ['musicscale'] }, loading: false,
  organization: null, subscription: null, isSubscriptionLoaded: true, entitlements: null,
  isEntitlementsLoaded: true, isGlobalAdmin: false, needsRepair: false,
}) }));
vi.mock('../../contexts/EcosystemContext', () => ({ useEcosystem: () => ({ context: null }) }));
vi.mock('../../pages/TenantOnboarding', () => ({ default: () => <div>lazy-tenant-onboarding</div> }));

import StartGateway from '../../pages/StartGateway';

describe('StartGateway onboarding boundary', () => {
  it('renders the no-organization experience through its lazy boundary', async () => {
    render(<StartGateway />);
    expect(await screen.findByText('lazy-tenant-onboarding')).toBeInTheDocument();
  });
});
