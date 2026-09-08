import fs from "node:fs";
import assert from "node:assert/strict";

const firebase = JSON.parse(fs.readFileSync("firebase.json", "utf8"));
const hosting = firebase.hosting;
assert.ok(hosting, "firebase.json must define Hosting");
assert.equal(hosting.target, "musicscale", "MusicScale must deploy only to its dedicated Hosting target");
assert.equal(hosting.public, "dist", "Hosting must serve the Vite dist directory");

const rewrites = hosting.rewrites ?? [];
assert.ok(rewrites.length >= 2, "Hosting must define API and SPA rewrites");
assert.equal(rewrites[0]?.source, "/api/**", "API rewrite must precede the SPA fallback");
assert.equal(rewrites[0]?.run?.serviceId, "musicscale-api", "API must route to the canonical Cloud Run service");
assert.equal(rewrites[0]?.run?.region, "us-central1", "Cloud Run region must remain explicit");
assert.equal(rewrites[0]?.run?.pinTag, true, "Hosting releases must pin the Cloud Run revision");
assert.equal(rewrites.at(-1)?.source, "**", "SPA fallback must be last");
assert.equal(rewrites.at(-1)?.destination, "/index.html", "SPA fallback must resolve to index.html");

const rc = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
const sites = rc?.targets?.millionsnest?.hosting?.musicscale;
assert.deepEqual(sites, ["musicscale-millionsnest"], "Hosting target must map to the dedicated MusicScale site");

const dockerfile = fs.readFileSync("Dockerfile", "utf8");
assert.match(dockerfile, /npm ci --no-audit --no-fund/, "Container build must use deterministic npm ci");
assert.match(dockerfile, /npm run build/, "Container build must use the canonical production build");
assert.match(dockerfile, /NODE_ENV=production/, "Runtime container must run in production mode");
assert.match(dockerfile, /DEPLOY_ENV=production/, "Runtime must explicitly identify production for fail-closed diagnostics");
assert.doesNotMatch(dockerfile, /STRIPE_SECRET_KEY=|GEMINI_API_KEY=|FIREBASE_SERVICE_ACCOUNT/, "No production secret may be baked into the image");

const server = fs.readFileSync("server.ts", "utf8");
assert.match(server, /process\.env\.PORT\s*\|\|\s*3000/, "Server must honor Cloud Run's PORT environment variable");
assert.match(server, /process\.env\.DEPLOY_ENV/, "Provider-neutral deployment environment must be supported");
assert.match(server, /process\.env\.VERCEL_ENV/, "Vercel rollback compatibility must remain during migration");
assert.match(server, /NODE_ENV === "production"/, "Production diagnostics must fail closed without provider metadata");

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
assert.equal(vercel?.git?.deploymentEnabled, false, "Vercel must remain manual-only as a rollback path during migration");

console.log("Firebase Hosting + Cloud Run migration contract: OK");
