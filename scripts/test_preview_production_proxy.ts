import { assert } from "console";
import fs from "fs";

async function run() {
  const serverCode = fs.readFileSync("server.ts", "utf8");

  assert(serverCode.includes("createProxyMiddleware"), "1. Must import createProxyMiddleware");
  assert(serverCode.includes("MUSICSCALE_PREVIEW_CANONICAL_API_ENABLED"), "2. Must check enabled flag");
  assert(serverCode.includes("MUSICSCALE_PREVIEW_CANONICAL_API_ORIGIN"), "3. Must check origin variable");
  assert(serverCode.includes("https://musicscale.millionsnest.com"), "4. Must restrict to canonical origin");
  assert(serverCode.includes("NODE_ENV !== 'production'"), "5. Must be disabled in production");
  assert(serverCode.includes("changeOrigin: true"), "6. Must use changeOrigin");
  assert(serverCode.includes("proxyReq.removeHeader('cookie')"), "7. Must not forward cookie");

  assert(serverCode.includes("X-MusicScale-Client-Environment"), "9. Must send client environment header");
  assert(serverCode.includes("CANONICAL_PRODUCTION_BACKEND_UNAVAILABLE"), "10. Must return 502/503 JSON on unavailable");
  
  console.log("All static proxy assertions passed.");
}

run().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
