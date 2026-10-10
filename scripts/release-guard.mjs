#!/usr/bin/env node
// Fail-closed release synchronization; no force push or application/data deployments.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const REPO = "prdanielcunha/musicscale";
export const isValidSha = v => typeof v === "string" && /^[0-9a-f]{40}$/.test(v);
export const isSensitivePath = p => /^(?:firestore(?:\.indexes)?\.rules|firestore\.indexes\.json|firebase\.json|\.firebaserc|server\.ts|Dockerfile|functions\/|services\/(?:server|firebase|ecosystem|effectiveEntitlements|firestore|stripe|billing|nestai)|contexts\/(?:AuthContext|EcosystemContext)|utils\/rbac\.ts|ops\/(?:hosting-release|cloudrun-release)\.txt|\.github\/workflows\/(?:firebase-production-deploy|cloudrun-private-deploy|deploy-firestore-rules|deploy-firebase-functions|release-guard)\.yml|scripts\/release-guard\.(?:mjs|test\.mjs)|AGENTS\.md)/.test(p);
export function assessChangedPaths(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  return {count:unique.length, sensitive:unique.filter(isSensitivePath)};
}
function insist(condition, reason) { if(!condition) throw new Error(reason); }
function git(args) { return execFileSync("git", args, {encoding:"utf8", maxBuffer:16777216}).trim(); }
async function github(method, path, token, payload) {
 const res = await fetch("https://api.github.com/repos/" + REPO + path, {
   method, headers: {Authorization:"Bearer "+token, Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28", "Content-Type":"application/json"},
   body:payload===undefined?undefined:JSON.stringify(payload)
 });
 const value = await res.json();
 insist(res.ok, "GitHub refused "+method+" "+path+" ("+res.status+"): "+JSON.stringify(value).slice(0,400));
 return value;
}
export async function promote() {
 const token=process.env.GITHUB_TOKEN, sha=process.env.EXPECTED_MAIN_SHA;
 insist(process.env.GITHUB_REPOSITORY===REPO, "Unexpected repository");
 insist(process.env.GITHUB_EVENT_NAME==="workflow_dispatch", "Manual dispatch only");
 insist(process.env.GITHUB_REF==="refs/heads/main", "Dispatch from main only");
 insist(Boolean(token), "Missing GitHub credential");
 insist(isValidSha(sha), "Full main SHA required, never a branch alias");
 insist(process.env.RELEASE_CONFIRMATION==="PROMOTE", "Typed PROMOTE confirmation required");
 git(["fetch","--no-tags","origin","main","production"]);
 const oldMain=git(["rev-parse","refs/remotes/origin/main"]), oldProd=git(["rev-parse","refs/remotes/origin/production"]);
 insist(oldMain===sha, "Main moved: re-approve SHA");
 const main=await github("GET","/branches/main",token), prod=await github("GET","/branches/production",token);
 insist(main.commit.sha===sha && prod.commit.sha===oldProd, "Concurrent update detected");
 insist(prod.protected===true, "Protected production is mandatory");
 if(sha===oldProd) { console.log("ALREADY_SYNCHRONIZED "+sha); return; }
 try { git(["merge-base","--is-ancestor",oldProd,sha]); } catch { throw new Error("Divergent history: PR reconciliation required; force prohibited"); }
 const files=execFileSync("git",["diff","--name-only","-z",oldProd,sha],{encoding:"utf8",maxBuffer:16777216}).split("\0").filter(Boolean);
 const analysis=assessChangedPaths(files);
 insist(!analysis.sensitive.length, "Sensitive files require separate reviewed release: "+analysis.sensitive.join(", "));
 const runs=await github("GET","/actions/workflows/musicscale-qa.yml/runs?branch=main&event=push&head_sha="+sha+"&per_page=100",token);
 const exact=(runs.workflow_runs||[]).filter(r=>r.head_sha===sha && r.head_branch==="main" && r.event==="push").sort((a,b)=>b.run_number-a.run_number);
 insist(exact.length && exact[0].status==="completed" && exact[0].conclusion==="success", "Full QA has not passed for main SHA");
 const jobs=await github("GET","/actions/runs/"+exact[0].id+"/jobs?per_page=100",token);
 for(const required of ["test","functions"]) {
   insist((jobs.jobs||[]).some(j=>j.name===required && j.conclusion==="success"), "QA gate missing/failing: "+required);
 }
 const nextMain=await github("GET","/branches/main",token), nextProd=await github("GET","/branches/production",token);
 insist(nextMain.commit.sha===sha && nextProd.commit.sha===oldProd, "Concurrent update detected before promotion");
 await github("PATCH","/git/refs/heads/production",token,{sha,force:false});
 const endMain=await github("GET","/branches/main",token), endProd=await github("GET","/branches/production",token);
 insist(endMain.commit.sha===sha && endProd.commit.sha===sha, "SHAs differ after promotion");
 console.log("RELEASE_GUARD_SYNCED "+sha+" files="+analysis.count);
 console.log("No Firebase/Cloud Run deploy, Stripe, Firestore, secrets or migration executed");
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 promote().catch(e=>{console.error("RELEASE_GUARD_BLOCKED:",e.message);process.exitCode=1;});
}
