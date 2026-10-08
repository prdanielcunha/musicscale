import {describe,it,expect} from 'vitest';
import {hubMusicScaleTrialWindow,HUB_MUSICSCALE_TRIAL_BASE_MS,resolveHubMusicScaleTrialFromDb}
  from '../../services/server/hubMusicScaleTrial';

describe('14-day Hub MusicScale evaluation',()=>{
  const start=Date.parse('2026-10-01T12:00:00Z'),end=start+HUB_MUSICSCALE_TRIAL_BASE_MS;
  const trial={
    appId:'musicscale',organizationId:'org-pilot',source:'hub_internal_trial',
    status:'active',revoked:false,consumed:true,grantVersion:2,
    beginsAt:{toMillis:()=>start},expiresAt:{toMillis:()=>end},
  };
  it('permits exactly 14 days and expires at server deadline',()=>{
    expect(hubMusicScaleTrialWindow(trial,'org-pilot',start).active).toBe(true);
    expect(hubMusicScaleTrialWindow(trial,'org-pilot',end-1).active).toBe(true);
    expect(hubMusicScaleTrialWindow(trial,'org-pilot',end).expired).toBe(true);
  });
  it('only honors a single Hub-issued extension of at most seven days',()=>{
    const extra={...trial,extensionCount:1,extensionDays:7,
      extensionEndsAt:{toMillis:()=>end+7*86_400_000}};
    expect(hubMusicScaleTrialWindow(extra,'org-pilot',end+1).active).toBe(true);
    expect(hubMusicScaleTrialWindow(extra,'org-pilot',end+7*86_400_000).expired).toBe(true);
    expect(hubMusicScaleTrialWindow({...extra,extensionCount:2},'org-pilot',end).valid).toBe(false);
    expect(hubMusicScaleTrialWindow({...extra,extensionDays:8},'org-pilot',end).valid).toBe(false);
  });
  it('rejects fake grants, wrong tenant, source and tampered original deadline',()=>{
    expect(hubMusicScaleTrialWindow(trial,'org-other',start).valid).toBe(false);
    expect(hubMusicScaleTrialWindow({...trial,source:'stripe'},'org-pilot',start).valid).toBe(false);
    expect(hubMusicScaleTrialWindow({...trial,consumed:false},'org-pilot',start).valid).toBe(false);
    expect(hubMusicScaleTrialWindow({...trial,expiresAt:{toMillis:()=>end+1}},'org-pilot',start).valid).toBe(false);
  });
  it('uses server-side Firestore only when trial migration gate is enabled',async()=>{
    let reads=0;
    const db={collection:()=>({doc:()=>({get:async()=>{reads++;return {exists:true,data:()=>trial}}})})};
    expect((await resolveHubMusicScaleTrialFromDb({db,organizationId:'org-pilot',enabled:false,now:start})).active).toBe(false);
    expect(reads).toBe(0);
    expect((await resolveHubMusicScaleTrialFromDb({db,organizationId:'org-pilot',enabled:true,now:start})).active).toBe(true);
    expect(reads).toBe(1);
  });
});
