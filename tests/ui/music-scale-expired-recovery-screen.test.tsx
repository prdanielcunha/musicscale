import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isOwner: true,
  isGlobalAdmin: false,
  billingCapability: false,
  trialStatus: 'expired',
  trialSource: 'hub_internal_trial',
  refreshSubscriptionAccess: vi.fn(async () => ({ status:'active', reason:'payment_confirmed' })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    loading:false,
    refreshSubscriptionAccess:mocks.refreshSubscriptionAccess,
    organization:{id:'private-org-id'},
    entitlements:{status:mocks.trialStatus,entitlementSource:mocks.trialSource},
    isOwner:mocks.isOwner,
    isGlobalAdmin:mocks.isGlobalAdmin,
  }),
}));
vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({hasCapability:(key:string)=>key==='billing.manage'&&mocks.billingCapability}),
}));
vi.mock('../../services/entitlementsService', () => ({
  entitlementsService:{getMillionsNestBaseUrl:()=> 'https://millionsnest.com'},
}));
vi.mock('../../lib/logger', () => ({
  logger:{info:vi.fn(),error:vi.fn()},
}));

import { MissingSubscriptionScreen } from '../../components/premium/MissingSubscriptionScreen';

const expired = {
  loaded:true,valid:false,status:'inactive' as const,reason:'hub_trial_expired',
  retryable:false,technicalError:false,
};
afterEach(() => {
  cleanup();
  mocks.isOwner=true;
  mocks.isGlobalAdmin=false;
  mocks.billingCapability=false;
  mocks.trialStatus='expired';
  mocks.trialSource='hub_internal_trial';
  mocks.refreshSubscriptionAccess.mockClear();
});

describe('MusicScale premium suspension presentation', () => {
  it('shows the approved trial-ended recovery page and canonical Hub action for owner', () => {
    render(<MissingSubscriptionScreen resolution={expired} />);
    expect(screen.getByRole('heading',{name:'premium.recovery.expiredTitle'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'premium.recovery.plansAction'})).toBeTruthy();
    expect(screen.getByText('premium.recovery.preservedTitle')).toBeTruthy();
    expect(screen.getByText('premium.recovery.restrictedMusicTitle')).toBeTruthy();
    expect(screen.queryByText('private-org-id')).toBeNull();
  });

  it('does not reveal a plan, payment call to action or card to an ordinary member', () => {
    mocks.isOwner=false;
    render(<MissingSubscriptionScreen resolution={expired} />);
    expect(screen.getByRole('heading',{name:'premium.recovery.memberTitle'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'premium.recovery.hubAction'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'premium.recovery.plansAction'})).toBeNull();
    expect(screen.queryByText('premium.recovery.regularizeAction')).toBeNull();
  });

  it('permits the billing.manage capability without requiring organization ownership', () => {
    mocks.isOwner=false;
    mocks.billingCapability=true;
    render(<MissingSubscriptionScreen resolution={expired} />);
    expect(screen.getByRole('button',{name:'premium.recovery.plansAction'})).toBeTruthy();
  });

  it('does not confuse a temporary access synchronization failure with trial expiry', async () => {
    render(<MissingSubscriptionScreen resolution={{
      ...expired,status:'unavailable',reason:'network_error',technicalError:true,retryable:true,
    }} />);
    expect(screen.getByRole('heading',{name:'premium.recovery.syncTitle'})).toBeTruthy();
    expect(screen.queryByText('premium.recovery.preservedTitle')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'premium.recovery.retryAction'}));
    await waitFor(() => expect(mocks.refreshSubscriptionAccess).toHaveBeenCalledTimes(1));
  });
});
