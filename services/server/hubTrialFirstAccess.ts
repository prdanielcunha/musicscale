/** Hub owns trial time; MusicScale confirms authenticated app bootstrap. */
export async function confirmHubTrialFirstAccess(input:{
  organizationId:string;organization:any;authorization:string;fetchImpl?:typeof fetch;
}):Promise<void> {
  const app=input.organization?.apps?.musicscale;
  if(app?.trialSource!=='hub_internal_trial'||app?.status!=='pending_first_access')return;
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.organizationId)||!/^Bearer \S+$/.test(input.authorization))
    throw Error('HUB_TRIAL_FIRST_ACCESS_INVALID');
  try {
    const response=await (input.fetchImpl||fetch)('https://www.millionsnest.com/api/v1/billing/trial/first-access',{
      method:'POST',headers:{Authorization:input.authorization,'Content-Type':'application/json'},
      body:JSON.stringify({organizationId:input.organizationId}),signal:AbortSignal.timeout(8000),
    });
    const result=await response.json();
    if(!response.ok||result?.ok!==true||typeof result.started!=='boolean')throw Error('UNAVAILABLE');
  }catch {throw Error('HUB_TRIAL_FIRST_ACCESS_UNAVAILABLE');}
}
