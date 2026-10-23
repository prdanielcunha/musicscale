import {describe,it,expect} from 'vitest';
import {reserveHubTrialAiRequest} from '../../services/server/hubTrialAiBudget.js';
const now=Date.parse('2026-10-30T12:00:00Z');
function fixture(paid=false) {
 const docs=new Map<string,any>([
  ['organizations/org',{apps:{musicscale:{trialSource:'hub_internal_trial'}}}],
  ['subscriptions/org',paid?{apps:{musicscale:{status:'active',stripeSubscriptionId:'sub_paid',plan:'starter'}}}:{}],
  ['musicscale_internal_trials/org',{appId:'musicscale',organizationId:'org',source:'hub_internal_trial',status:'active',consumed:true,revoked:false,grantVersion:3,beginsAt:new Date(now),expiresAt:new Date(now+7*86400000)}],
 ]);
 const ref=(path:string):any=>({path,doc:(id:string)=>ref(path+'/'+id),collection:(id:string)=>ref(path+'/'+id)});
 return {docs,db:{collection:ref,runTransaction:async(fn:any)=>fn({get:async(r:any)=>({exists:docs.has(r.path),data:()=>docs.get(r.path)}),set:(r:any,d:any)=>docs.set(r.path,d)})}};
}
describe('Hub trial AI lifetime quota',()=>{
 it('allows ten requests across month boundaries and rejects further requests',async()=>{
  const x=fixture();
  for(let i=0;i<10;i++)await reserveHubTrialAiRequest(x.db,'org',now+i*12*3600000);
  await expect(reserveHubTrialAiRequest(x.db,'org',now+5*86400000)).rejects.toThrow('HUB_TRIAL_AI_LIMIT');
  expect(x.docs.get('organizations/org/musicscaleLiveAiUsage/trial').requests).toBe(10);
 });
 it('does not debit trials or change paid accounts',async()=>{
  const x=fixture(true); const before=JSON.stringify([...x.docs]);
  await reserveHubTrialAiRequest(x.db,'org',now);
  expect(JSON.stringify([...x.docs])).toBe(before);
 });
 it('rejects expiry and tampered counts without writes',async()=>{
  const x=fixture();
  await expect(reserveHubTrialAiRequest(x.db,'org',now+7*86400000)).rejects.toThrow('HUB_TRIAL_ACCESS_DENIED');
  expect(x.docs.has('organizations/org/musicscaleLiveAiUsage/trial')).toBe(false);
  x.docs.set('organizations/org/musicscaleLiveAiUsage/trial',{requests:-1});
  await expect(reserveHubTrialAiRequest(x.db,'org',now)).rejects.toThrow('HUB_TRIAL_QUOTA_UNAVAILABLE');
 });
});
