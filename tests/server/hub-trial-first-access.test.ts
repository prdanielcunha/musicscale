import {describe,it,expect,vi} from 'vitest';
import {confirmHubTrialFirstAccess} from '../../services/server/hubTrialFirstAccess.js';
const organization={apps:{musicscale:{trialSource:'hub_internal_trial',status:'pending_first_access'}}};
describe('Hub first successful app entry',()=>{
 it('never touches paid or existing trials',async()=>{
  const fn=vi.fn();
  for(const org of [{},{apps:{musicscale:{status:'active'}}},{apps:{musicscale:{trialSource:'hub_internal_trial',status:'trialing'}}}])
   await confirmHubTrialFirstAccess({organizationId:'org-a',organization:org,authorization:'Bearer token',fetchImpl:fn});
  expect(fn).not.toHaveBeenCalled();
 });
 it('confirms pending entry without client time',async()=>{
  const fn=vi.fn(async()=>new Response(JSON.stringify({ok:true,started:true}),{status:200}));
  await confirmHubTrialFirstAccess({organizationId:'org-a',organization,authorization:'Bearer token',fetchImpl:fn});
  expect(fn).toHaveBeenCalledOnce();
  const [url,options]=fn.mock.calls[0] as any;
  expect(url).toBe('https://www.millionsnest.com/api/v1/billing/trial/first-access');
  expect(options.method).toBe('POST');expect(JSON.parse(options.body)).toEqual({organizationId:'org-a'});
 });
 it('fails closed on denial, malformed response and timeout',async()=>{
  for(const fn of [vi.fn(async()=>new Response('{}',{status:403})),vi.fn(async()=>new Response('{"ok":true}',{status:200})),vi.fn(async()=>{throw Error('timeout')})])
   await expect(confirmHubTrialFirstAccess({organizationId:'org-a',organization,authorization:'Bearer token',fetchImpl:fn})).rejects.toThrow('HUB_TRIAL_FIRST_ACCESS_UNAVAILABLE');
 });
});
