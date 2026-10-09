import { resolveHubMusicScaleTrialFromDb } from './hubMusicScaleTrial.js';
import { resolvePaidMusicScaleContract } from './musicScalePaidContract.js';

const VALID_ORG_ID = /^[A-Za-z0-9_-]{1,128}$/;

type RequestLike = {
  path?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};
type ResponseLike = {
  status: (code: number) => { json: (payload: any) => unknown };
  set?: (key: string, value: string) => unknown;
};

const MUSIC_ENDPOINTS = [
  /^\/api\/v1\/music-data\/bootstrap\/?$/,
  /^\/api\/v1\/connect\/next-schedule(?:\/|$)/,
  /^\/api\/v1\/music-scales(?:\/|$)/,
  /^\/api\/v1\/band-scales(?:\/|$)/,
  /^\/api\/v1\/organizations\/[^/]+\/serve-guard(?:\/|$)/,
  /^\/api\/v1\/onboarding\/starter-pack(?:\/|$)/,
  /^\/api\/v1\/onboarding\/bootstrap\/?$/,
  /^\/api\/orgs\/[^/]+\/(?:member-directory|musicscale-members|join-requests)(?:\/|$)/,
  /^\/api\/orgs\/(?:invite|join|accept-invite)(?:\/|$)/,
  /^\/api\/(?:ai-import|ai-suggest-songs|ai-analyze-setlist|fix-chords)(?:\/|$)/,
  /^\/api\/library\/import\/?$/,
] as const;

/** Account, billing, support and eligibility endpoints deliberately remain accessible. */
export function isProtectedMusicWorkspaceApiPath(path: string): boolean {
  return MUSIC_ENDPOINTS.some(rule => rule.test(path));
}

function value(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

/** Reject disagreement among tenant selectors, including URL/body/header. */
export function musicWorkspaceOrgFromRequest(req: RequestLike):
  { organizationId: string | null; error: 'MISSING_ORGANIZATION_ID'|'CONFLICTING_ORGANIZATION_ID'|'INVALID_ORGANIZATION_ID'|null } {
  const path = value(req.path);
  const encodedInPath = path.match(/^\/api\/v1\/organizations\/([^/]+)\/serve-guard\b/)?.[1] ||
    path.match(/^\/api\/orgs\/([^/]+)\/(?:member-directory|musicscale-members|join-requests)\b/)?.[1];
  const ids = [
    req.headers?.['x-organization-id'], req.query?.organizationId,
    req.query?.orgId, req.body?.organizationId, req.body?.orgId, encodedInPath,
  ].map(value).filter(Boolean);
  if (!ids.length) return {organizationId:null,error:'MISSING_ORGANIZATION_ID'};
  if (ids.some(x=>!VALID_ORG_ID.test(x))) return {organizationId:null,error:'INVALID_ORGANIZATION_ID'};
  if (new Set(ids).size > 1) return {organizationId:null,error:'CONFLICTING_ORGANIZATION_ID'};
  return {organizationId:ids[0],error:null};
}

export async function canUseHubTrialMusicWorkspace(input: {
  db: any; organizationId: string; enabled: boolean; now?: number;
}): Promise<{ok:boolean; error?: 'HUB_TRIAL_EXPIRED'|'HUB_TRIAL_VERIFICATION_UNAVAILABLE'}> {
  if (!input.enabled) return {ok:true};
  const snap = await input.db.collection('organizations').doc(input.organizationId).get();
  // Non-trial users still follow their existing authorization and billing rules.
  if (!snap.exists || snap.data()?.apps?.musicscale?.trialSource !== 'hub_internal_trial')
    return {ok:true};
  try {
    const subscription = await input.db.collection('subscriptions').doc(input.organizationId).get();
    if (resolvePaidMusicScaleContract(subscription.exists?subscription.data():null).valid)
      return {ok:true};
    const grant = await resolveHubMusicScaleTrialFromDb({
      db:input.db, organizationId:input.organizationId, enabled:true, now:input.now,
    });
    return grant.active ? {ok:true} : {ok:false,error:'HUB_TRIAL_EXPIRED'};
  } catch {
    // Fail closed once an organization is known to be a Hub trial.
    return {ok:false,error:'HUB_TRIAL_VERIFICATION_UNAVAILABLE'};
  }
}

/** Register before MusicScale BFF, AI, Connect and music command routes. */
export function createHubTrialWorkspaceMiddleware(deps:{db:any;enabled:()=>boolean}) {
  return async (req:RequestLike,res:ResponseLike,next:()=>void) => {
    if (!deps.enabled() || !isProtectedMusicWorkspaceApiPath(value(req.path))) return next();
    const selected = musicWorkspaceOrgFromRequest(req);
    if (selected.error || !selected.organizationId) {
      return res.status(400).json({error:selected.error || 'MISSING_ORGANIZATION_ID'});
    }
    try {
      const decision = await canUseHubTrialMusicWorkspace({
        db:deps.db, organizationId:selected.organizationId, enabled:true,
      });
      if (!decision.ok) {
        res.set?.('Cache-Control','private, no-store, max-age=0');
        return res.status(decision.error==='HUB_TRIAL_EXPIRED'?403:503)
          .json({error:decision.error});
      }
    } catch {
      // No musical response is released when entitlement service is uncertain.
      return res.status(503).json({error:'HUB_TRIAL_VERIFICATION_UNAVAILABLE'});
    }
    return next();
  };
}
