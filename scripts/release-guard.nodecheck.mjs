import test from "node:test";
import assert from "node:assert/strict";
import {isValidSha,isSensitivePath,assessChangedPaths} from "./release-guard.mjs";
test("full valid SHA mandatory",()=>{assert.equal(isValidSha("a".repeat(40)),true);assert.equal(isValidSha("a".repeat(12)),false);assert.equal(isValidSha("main"),false);});
test("sensitive changes blocked",()=>{
 for(const name of ["server.ts","firestore.rules","functions/src/index.ts","services/ecosystem/hub.ts","contexts/AuthContext.tsx","utils/rbac.ts","ops/hosting-release.txt",".github/workflows/release-guard.yml","AGENTS.md"])
  assert.equal(isSensitivePath(name),true,name);
});
test("presentation and docs are ordinary paths",()=>{for(const n of ["pages/Dashboard.tsx","components/Header.tsx","docs/guide.md"])assert.equal(isSensitivePath(n),false,n);});
test("deduplicate and classify",()=>assert.deepEqual(assessChangedPaths(["pages/x.tsx","server.ts","server.ts",""]),{count:2,sensitive:["server.ts"]}));
