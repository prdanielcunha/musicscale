import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { resolvePaidMusicScaleContract } from '../../services/server/musicScalePaidContract';

const server = fs.readFileSync('server.ts', 'utf8');

describe('new Hub no-card trial paid reactivation is MusicScale-specific', () => {
  it('never borrows root NestLocal active status or Stripe ID', () => {
    expect(resolvePaidMusicScaleContract({
      app:'nestlocal', status:'active', stripeSubscriptionId:'sub_local',
      apps:{nestlocal:{status:'active',stripeSubscriptionId:'sub_local'}}
    }).valid).toBe(false);
    expect(resolvePaidMusicScaleContract({
      status:'active', stripeSubscriptionId:'sub_local', subscriptionId:'sub_local',
      apps:{musicscale:{status:'inactive'},nestlocal:{status:'active'}}
    }).valid).toBe(false);
  });

  it('accepts only an app-specific paid Stripe MusicScale contract', () => {
    expect(resolvePaidMusicScaleContract({
      status:'active', stripeSubscriptionId:'sub_unrelated',
      apps:{musicscale:{status:'active',stripeSubscriptionId:'sub_ms',plan:'advanced'}}
    })).toMatchObject({valid:true,status:'active',plan:'advanced'});
    expect(resolvePaidMusicScaleContract({
      app:'musicscale',status:'trialing',stripeSubscriptionId:'sub_ms_legacy',plan:'pro'
    })).toMatchObject({valid:true,status:'trialing',plan:'pro'});
  });

  it('denies root aliases and unverified or pending payment', () => {
    for (const sub of [
      {app:'musicscale',status:'active',subscriptionId:'sub_unknown'},
      {app:'musicscale',status:'past_due',stripeSubscriptionId:'sub_past_due'},
      {apps:{musicscale:{status:'active'}}},
      {app:'musicscale',status:'active',stripeSubscriptionId:' '},
      {status:'active',stripeSubscriptionId:'sub_untagged'}
    ]) expect(resolvePaidMusicScaleContract(sub).valid).toBe(false);
  });

  it('uses the same verified resolver in limits and bulk Library import gates', () => {
    expect((server.match(/resolvePaidMusicScaleContract\(/g) || []).length).toBe(2);
    expect(server).not.toContain('contract.stripeSubscriptionId || data.stripeSubscriptionId');
    expect(server).not.toContain('contract.stripeSubscriptionId || billing.stripeSubscriptionId');
  });
});
