/**
 * Validates the Hub server-issued MusicScale trial in the product backend.
 * This path never grants an entitlement from user-controlled org projections.
 * Existing paid Stripe subscriptions are evaluated separately and first.
 */
export const HUB_MUSICSCALE_TRIAL_BASE_MS=14*86_400_000;
const DAY_MS=86_400_000;
function ms(value:unknown):number|null {
  if(value&&typeof value==='object'){
    const v=value as {toMillis?:()=>number;toDate?:()=>Date;seconds?:number};
    if(typeof v.toMillis==='function')return v.toMillis();
    if(typeof v.toDate==='function')return v.toDate().getTime();
    if(typeof v.seconds==='number')return v.seconds*1000;
  }
  if(value instanceof Date)return value.getTime();
  if(typeof value==='string'){
    const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:null;
  }
  return null;
}
export function hubMusicScaleTrialWindow(record:any,organizationId:string,now=Date.now()):{
  valid:boolean;active:boolean;expired:boolean;effectiveEndsAt:string|null;extended:boolean;
} {
  const no={valid:false,active:false,expired:false,effectiveEndsAt:null,extended:false};
  if(!organizationId||!record||record.organizationId!==organizationId||
      record.appId!=='musicscale'||record.source!=='hub_internal_trial'||
      record.status!=='active'||record.consumed!==true||record.revoked===true||
      !Number.isSafeInteger(record.grantVersion)||record.grantVersion<2)return no;
  const begins=ms(record.beginsAt),ends=ms(record.expiresAt);
  if(begins===null||ends===null||ends-begins!==HUB_MUSICSCALE_TRIAL_BASE_MS)return no;
  let effectiveEndsAt=ends;
  if(record.extensionCount===1){
    const days=record.extensionDays,extended=ms(record.extensionEndsAt);
    if(!Number.isSafeInteger(days)||days<1||days>7||
        extended!==ends+days*DAY_MS)return no;
    effectiveEndsAt=extended;
  }else if((record.extensionCount!==undefined&&record.extensionCount!==0)||
    record.extensionDays!=null||record.extensionEndsAt!=null)return no;
  return {valid:true,active:now>=begins&&now<effectiveEndsAt,
    expired:now>=effectiveEndsAt,effectiveEndsAt:new Date(effectiveEndsAt).toISOString(),
    extended:record.extensionCount===1};
}
/** Strict: a new Hub trial must be fully enabled AND verified, never cached indefinitely. */
export async function resolveHubMusicScaleTrialFromDb(input:{
  db:{collection:(name:string)=>{doc:(id:string)=>{get:()=>Promise<{exists:boolean;data:()=>any}>}}};
  organizationId:string;enabled:boolean;now?:number;
}) {
  if(!input.enabled)return {valid:false,active:false,expired:false,effectiveEndsAt:null,extended:false};
  const record=await input.db.collection('musicscale_internal_trials').doc(input.organizationId).get();
  return hubMusicScaleTrialWindow(record.exists?record.data():null,input.organizationId,input.now);
}
