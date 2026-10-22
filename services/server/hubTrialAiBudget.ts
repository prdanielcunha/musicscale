import {getFirestore} from 'firebase-admin/firestore';
import {resolvePaidMusicScaleContract} from './musicScalePaidContract.js';
import {hubMusicScaleTrialWindow} from './hubMusicScaleTrial.js';

export const HUB_TRIAL_AI_REQUEST_LIMIT = 10;
/** Lifetime quota shared with Hub AI. Called only after canonical Hub token authorization. */
export async function reserveHubTrialAiRequest(db:any = getFirestore(), organizationId:string, now = Date.now()):Promise<void> {
  const orgRef = db.collection('organizations').doc(organizationId);
  const subRef = db.collection('subscriptions').doc(organizationId);
  const trialRef = db.collection('musicscale_internal_trials').doc(organizationId);
  const usageRef = orgRef.collection('musicscaleLiveAiUsage').doc('trial');
  await db.runTransaction(async (tx:any) => {
    const [org, sub, trial, usage] = await Promise.all([tx.get(orgRef),tx.get(subRef),tx.get(trialRef),tx.get(usageRef)]);
    if (org.data()?.apps?.musicscale?.trialSource !== 'hub_internal_trial') return;
    if (resolvePaidMusicScaleContract(sub.data()).valid) return;
    if (!hubMusicScaleTrialWindow(trial.data(),organizationId,now).active) throw Error('HUB_TRIAL_ACCESS_DENIED');
    const used = Number(usage.data()?.requests || 0);
    if (!Number.isSafeInteger(used) || used < 0) throw Error('HUB_TRIAL_QUOTA_UNAVAILABLE');
    if (used >= HUB_TRIAL_AI_REQUEST_LIMIT) throw Error('HUB_TRIAL_AI_LIMIT');
    tx.set(usageRef,{organizationId,requests:used+1,limit:HUB_TRIAL_AI_REQUEST_LIMIT,updatedAt:new Date(now)},{merge:true});
  });
}
