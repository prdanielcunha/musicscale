import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PWA release freshness guard", () => {
  const indexSource = readFileSync("index.tsx", "utf8");
  const viteSource = readFileSync("vite.config.ts", "utf8");
  const firebaseSource = readFileSync("firebase.json", "utf8");
  const migrationSource = readFileSync("public/sw-migration-rescue.js", "utf8");

  it("checks a published version manifest during long-lived sessions", () => {
    expect(indexSource).toContain("VERSION_MANIFEST_PATH = '/version.json'");
    expect(indexSource).toContain("VERSION_CHECK_INTERVAL_MS = 30 * 1000");
    expect(indexSource).toContain("cache: 'no-store'");
    expect(indexSource).toContain("manifest.version !== APP_BUILD_VERSION");
    expect(indexSource).toContain("document.addEventListener('visibilitychange'");
    expect(indexSource).toContain("window.addEventListener('focus'");
    expect(indexSource).toContain("window.addEventListener('online'");
  });

  it("uses the version manifest as the release authority and only touches service workers during explicit recovery", () => {
    expect(indexSource).not.toContain("registration.update()");
    expect(indexSource).not.toContain("controllerchange");
    expect(indexSource).toContain("navigator.serviceWorker.getRegistrations()");
    expect(indexSource).toContain("registration.unregister()");
    expect(indexSource).toContain("releaseLegacyNavigationShell()");
  });

  it("bounds stale-shell recovery before forcing a unique network navigation", () => {
    expect(indexSource).toContain("Nova versão do MusicScale disponível");
    expect(indexSource).toContain("UPDATE_RECOVERY_TIMEOUT_MS = 1800");
    expect(indexSource).toContain("Promise.race");
    expect(indexSource).toContain("cache.delete(new Request(url), { ignoreSearch: true })");
    expect(indexSource).toContain("refreshUrl.searchParams.set('_ms_update'");
    expect(indexSource).toContain("window.location.replace");
  });

  it("keeps the app shell out of Workbox precache and navigation fallback", () => {
    expect(viteSource).toContain("globPatterns: ['**/*.{js,css,ico,png,svg,json}']");
    expect(viteSource).toContain("navigateFallback: null");
    expect(viteSource).toContain("globIgnores: ['version.json', 'sw-migration-rescue.js']");
    expect(viteSource).toContain("importScripts: ['/sw-migration-rescue.js']");
    expect(viteSource).not.toContain("js,css,html,ico");
  });

  it("performs a one-time migration for legacy workers that cached index.html", () => {
    expect(migrationSource).toContain("network-shell-v2");
    expect(migrationSource).toContain("musicscale-sw-migrations");
    expect(migrationSource).toContain("self.clients.claim()");
    expect(migrationSource).toContain("includeUncontrolled: true");
    expect(migrationSource).toContain("purgeLegacyNavigationShells");
    expect(migrationSource).toContain("ignoreSearch: true");
    expect(migrationSource).toContain("client.navigate(url.href)");
  });

  it("serves freshness control files without cache", () => {
    expect(firebaseSource).toContain('"source": "!/api/**"');
    expect(firebaseSource).toContain('"source": "/version.json"');
    expect(firebaseSource).toContain('"source": "/sw.js"');
    expect(firebaseSource).toContain('"source": "/sw-migration-rescue.js"');
    expect(firebaseSource).toContain('"value": "no-cache,no-store,must-revalidate"');
  });

  it("activates fresh workers and removes obsolete caches", () => {
    expect(viteSource).toContain("cleanupOutdatedCaches: true");
    expect(viteSource).toContain("clientsClaim: true");
    expect(viteSource).toContain("skipWaiting: true");
  });
});
