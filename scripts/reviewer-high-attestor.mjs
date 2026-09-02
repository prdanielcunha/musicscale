import process from 'node:process';
export const REVIEWER_HIGH_CONTEXT = 'reviewer-high';
export const REVIEWER_HIGH_DESCRIPTION = 'reviewer-high: APPROVED; attestation=target-url';
export const REVIEWER_HIGH_SCHEMA = 'musicscale.reviewer-high.v1';
export const PRODUCTION_REF = 'refs/heads/production';
export const AUTHORIZED_WORKFLOW_PATH = '.github/workflows/controlled-global-song-metrics-backfill-executor.yml';
const fail = (x) => { throw new Error(x); };
const sha = (x) => typeof x === 'string' && /^[0-9a-f]{40}$/i.test(x);
export function validateDecision(d) {
 if (d.decision !== 'HIGH') fail('REVIEWER_HIGH_DECISION_NOT_HIGH');
 if (!sha(d.targetSha)||!sha(d.authorizedSha)) fail('REVIEWER_HIGH_SHA_INVALID');
 if (d.targetSha !== d.authorizedSha) fail('REVIEWER_HIGH_AUTHORIZED_SHA_MISMATCH');
 if (d.workflowPath !== AUTHORIZED_WORKFLOW_PATH) fail('REVIEWER_HIGH_WORKFLOW_PATH_UNAUTHORIZED');
 if (d.workflowRef !== PRODUCTION_REF) fail('REVIEWER_HIGH_WORKFLOW_REF_UNAUTHORIZED');
 if (d.targetRef !== PRODUCTION_REF && !/^refs\/pull\/[1-9][0-9]*\/head$/.test(d.targetRef)) fail('REVIEWER_HIGH_TARGET_REF_UNAUTHORIZED'); return d;
}
export function buildAttestationTargetUrl(repository,d) { const u=new URL('https://github.com/'+repository+'/commit/'+d.targetSha); for(const [k,v] of Object.entries({schema:REVIEWER_HIGH_SCHEMA,certification_report:'APPROVED',reviewed_sha:d.targetSha,authorized_sha:d.authorizedSha,workflow_path:d.workflowPath,workflow_ref:d.workflowRef}))u.searchParams.set(k,v);return u.toString(); }
async function api(base,path,token,opts={},fetchImpl=fetch){const r=await fetchImpl(new URL(path,base+'/'),{...opts,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...opts.headers}});if(!r.ok)fail('REVIEWER_HIGH_GITHUB_API_HTTP_'+r.status);return r.json();}
export async function verifyTarget({apiUrl,repository,token,decision,fetchImpl=fetch}) { if(decision.targetRef===PRODUCTION_REF){const r=await api(apiUrl,'repos/'+repository+'/git/ref/heads/production',token,{},fetchImpl);if(r?.object?.type!=='commit'||r.object.sha!==decision.targetSha)fail('REVIEWER_HIGH_PRODUCTION_SHA_MISMATCH');}else{const r=await api(apiUrl,'repos/'+repository+'/pulls/'+decision.targetRef.split('/')[2],token,{},fetchImpl);if(r?.state!=='open'||r?.head?.sha!==decision.targetSha)fail('REVIEWER_HIGH_PR_HEAD_MISMATCH');} }
export async function postSingleAttestation({apiUrl,repository,token,decision,fetchImpl=fetch}) {const s=await api(apiUrl,'repos/'+repository+'/commits/'+decision.targetSha+'/statuses?per_page=100',token,{},fetchImpl);if(!Array.isArray(s))fail('REVIEWER_HIGH_STATUSES_MALFORMED');if(s.some(x=>x.context===REVIEWER_HIGH_CONTEXT))fail('REVIEWER_HIGH_STATUS_ALREADY_EXISTS');return api(apiUrl,'repos/'+repository+'/statuses/'+decision.targetSha,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:'success',context:REVIEWER_HIGH_CONTEXT,description:REVIEWER_HIGH_DESCRIPTION,target_url:buildAttestationTargetUrl(repository,decision)})},fetchImpl);}
async function main(){if(process.env.GITHUB_REF!==PRODUCTION_REF)fail('REVIEWER_HIGH_WORKFLOW_NOT_ON_PRODUCTION');const get=x=>{if(!process.env[x])fail('REVIEWER_HIGH_'+x+'_MISSING');return process.env[x];};const d=validateDecision({decision:get('INPUT_DECISION'),targetSha:get('INPUT_TARGET_SHA'),authorizedSha:get('INPUT_AUTHORIZED_SHA'),workflowPath:get('INPUT_WORKFLOW_PATH'),workflowRef:get('INPUT_WORKFLOW_REF'),targetRef:get('INPUT_TARGET_REF')});const repository=get('GITHUB_REPOSITORY'),token=get('GITHUB_TOKEN'),apiUrl=process.env.GITHUB_API_URL??'https://api.github.com';await verifyTarget({apiUrl,repository,token,decision:d});await postSingleAttestation({apiUrl,repository,token,decision:d});}
if(import.meta.url==='file://'+process.argv[1])main().catch(e=>{console.error(e.message);process.exitCode=1;});
