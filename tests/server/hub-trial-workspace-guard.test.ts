import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

import {
  canUseHubTrialMusicWorkspace, createHubTrialWorkspaceMiddleware,
  isProtectedMusicWorkspaceApiPath, musicWorkspaceOrgFromRequest,
} from '../../services/server/hubTrialWorkspaceGuard';

const DAY=86_400_000;
const now=Date.now();
const orgId='org-1';
const validTrial={
  appId:'musicscale',organizationId:orgId,source:'hub_internal_trial',
  status:'active',consumed:true,revoked:false,grantVersion:2,
  beginsAt:new Date(now-2*DAY),expiresAt:new Date(now+12*DAY),
};
function fakeDb(data:{
  marker?:boolean;trial?:unknown;subscription?:unknown;throwOnTrial?:boolean;
}={}) {
  return {
    collection:(name:string)=>({
      doc:(key:string)=>({
        get:async()=>{
          if(name==='musicscale_internal_trials'&&data.throwOnTrial)throw Error('DB_DOWN');
          const v=name==='organizations' ? {
            apps:{musicscale:{status:'trialing',trialSource:data.marker?'hub_internal_trial':'stripe_trial'}}
          } : name==='subscriptions'?data.subscription:name==='musicscale_internal_trials'?data.trial:undefined;
          return {exists:v!==undefined,data:()=>v};
        },
      })
    }),
  };
}

describe('Hub internal trial music gateway protects Admin SDK routes',()=>{
  it('classifies musical endpoints but leaves billing/account/support accessible',()=>{
    for(const path of [
      '/api/v1/music-data/bootstrap','/api/v1/connect/next-schedule/repertoire',
      '/api/v1/music-scales/scale-1/publish','/api/v1/band-scales/band-1',
      '/api/v1/organizations/org-1/serve-guard/evaluate',
      '/api/v1/onboarding/starter-pack/import','/api/orgs/org-1/member-directory',
      '/api/ai-import','/api/ai-suggest-songs','/api/ai-analyze-setlist','/api/library/import',
    ])expect(isProtectedMusicWorkspaceApiPath(path)).toBe(true);
    for(const path of ['/api/v1/organizations/org-1/limits',
      '/api/ecosystem/my-context','/api/support/send','/api/orgs/check-access',
      '/api/changelog','/api/admin/billing-access-diagnostics'])
      expect(isProtectedMusicWorkspaceApiPath(path)).toBe(false);
  });

  it('rejects missing, forged or mixed tenant selectors',()=>{
    expect(musicWorkspaceOrgFromRequest({path:'/api/v1/music-data/bootstrap',query:{}}).error)
      .toBe('MISSING_ORGANIZATION_ID');
    expect(musicWorkspaceOrgFromRequest({path:'/api/v1/music-data/bootstrap',
      headers:{'x-organization-id':'org-a'},query:{organizationId:'org-b'}}).error)
      .toBe('CONFLICTING_ORGANIZATION_ID');
    expect(musicWorkspaceOrgFromRequest({path:'/api/orgs/org-1/member-directory'})
      .organizationId).toBe('org-1');
    expect(musicWorkspaceOrgFromRequest({path:'/api/v1/organizations/org-1/serve-guard/evaluate'})
      .organizationId).toBe('org-1');
  });

  it('backend never trusts a disabled acquisition flag to recognize an existing grant',()=>{
    const server=fs.readFileSync('server.ts','utf8');
    expect(server).toContain('app.use(createHubTrialWorkspaceMiddleware({ db }))');
    expect((server.match(/enabled:true, \/\/ Recognition of EXISTING grants/g)||[]).length).toBe(2);
    expect(server).not.toContain("enabled:process.env.MUSICSCALE_HUB_TRIAL_V2_ENABLED === 'true'");
  });
  it('does not bypass expired grants when new trial acquisition flag is disabled', async()=>{
    const expired={...validTrial,beginsAt:new Date(now-15*DAY),expiresAt:new Date(now-DAY)};
    const old=process.env.MUSICSCALE_HUB_TRIAL_V2_ENABLED;
    try {
      process.env.MUSICSCALE_HUB_TRIAL_V2_ENABLED='false';
      expect(await canUseHubTrialMusicWorkspace({db:fakeDb({marker:true,trial:expired}),
        organizationId:orgId,now})).toEqual({ok:false,error:'HUB_TRIAL_EXPIRED'});
    } finally {
      if(old===undefined)delete process.env.MUSICSCALE_HUB_TRIAL_V2_ENABLED;
      else process.env.MUSICSCALE_HUB_TRIAL_V2_ENABLED=old;
    }
  });
  it('allows legacy organization regardless of internal trial toggle',async()=>{
    expect((await canUseHubTrialMusicWorkspace({db:fakeDb({marker:false}),organizationId:orgId})).ok).toBe(true);
  });
  it('allows active server-issued Hub trial and verified MusicScale paid conversion',async()=>{
    expect((await canUseHubTrialMusicWorkspace({db:fakeDb({marker:true,trial:validTrial}),
      organizationId:orgId,now})).ok).toBe(true);
    const paid={apps:{musicscale:{status:'active',stripeSubscriptionId:'sub_ms'}}};
    expect((await canUseHubTrialMusicWorkspace({db:fakeDb({marker:true,trial:{...validTrial,status:'expired'},subscription:paid}),
      organizationId:orgId,now})).ok).toBe(true);
  });
  it('denies expired trial even if another app has active Stripe subscription',async()=>{
    const other={status:'active',stripeSubscriptionId:'sub_local',
      apps:{nestlocal:{status:'active',stripeSubscriptionId:'sub_local'}}};
    const expired={...validTrial,beginsAt:new Date(now-15*DAY),expiresAt:new Date(now-DAY)};
    expect(await canUseHubTrialMusicWorkspace({db:fakeDb({marker:true,trial:expired,subscription:other}),
      organizationId:orgId,now})).toEqual({ok:false,error:'HUB_TRIAL_EXPIRED'});
  });
  it('fails closed on untrusted grants and read outage after a new trial is identified',async()=>{
    expect((await canUseHubTrialMusicWorkspace({db:fakeDb({marker:true,trial:{...validTrial,revoked:true}}),
      organizationId:orgId,now})).ok).toBe(false);
    expect(await canUseHubTrialMusicWorkspace({db:fakeDb({marker:true,throwOnTrial:true}),
      organizationId:orgId,now})).toEqual({ok:false,error:'HUB_TRIAL_VERIFICATION_UNAVAILABLE'});
  });
  it('keeps the existing HTTP error message on missing tenant without bypassing guard',async()=>{
    const middleware=createHubTrialWorkspaceMiddleware({db:fakeDb({marker:true})});
    const next=vi.fn(),json=vi.fn();
    const status=vi.fn(()=>({json}));
    await middleware({path:'/api/v1/music-scales/scale-1/publish',headers:{authorization:'Bearer fake'}},
      {status},next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error:'X-Organization-Id is required',code:'MISSING_ORGANIZATION_ID'
    });
  });
  it('middleware returns 403 and never runs the next handler on expired cohort',async()=>{
    const expired={...validTrial,beginsAt:new Date(now-15*DAY),expiresAt:new Date(now-DAY)};
    const guard=createHubTrialWorkspaceMiddleware({db:fakeDb({marker:true,trial:expired})});
    const next=vi.fn();const json=vi.fn();const set=vi.fn();
    await guard({path:'/api/v1/music-data/bootstrap',query:{organizationId:orgId}},
      {status:vi.fn(()=>({json})),set},next);
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({error:'HUB_TRIAL_EXPIRED'});
    expect(set).toHaveBeenCalledWith('Cache-Control','private, no-store, max-age=0');
  });
});
