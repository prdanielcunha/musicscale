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

  it("uses the version manifest as the only app update authority", () => {
    expect(indexSource).not.toContain("registration.update()");
    expect(indexSource).not.toContain("registration.unregister()");
    expect(indexSource).not.toContain("controllerchange");
    expect(indexSource).not.toContain("navigator.serviceWorker.getRegistration()");
  });

  it("updates with direct network navigation instead of waiting on WebKit service worker APIs", () => {
    expect(indexSource).toContain("Nova versão do MusicScale disponível");
    expect(indexSource).toContain("window.requestAnimationFrame");
    expect(indexSource).toContain("navigateToLatestVersion()");
    expect(indexSource).toContain("window.location.replace");
    expect(indexSource).not.toContain("UPDATE_CLICK_FALLBACK_MS");
    expect(indexSource).not.toContain("SERVICE_WORKER_OPERATION_TIMEOUT_MS");
  });

  it("keeps the app shell out of Workbox precache and navigation fallback", () => {
    expect(viteSource).toContain("globPatterns: ['**/*.{js,css,ico,png,svg,json}']");
    expect(viteSource).toContain("navigateFallback: null");
    expect(viteSource).toContain("globIgnores: ['version.json', 'sw-migration-rescue.js']");
    expect(viteSource).toContain("importScripts: ['/sw-migration-rescue.js']");
    expect(viteSource).not.toContain("js,css,html,ico");
  });

  it("performs a one-time migration for legacy workers that cached index.html", () => {
    expect(migrationSource).toContain("network-shell-v1");
    expect(migrationSource).toContain("musicscale-sw-migrations");
    expect(migrationSource).toContain("self.clients.claim()");
    expect(migrationSource).toContain("includeUncontrolled: true");
    expect(migrationSource).toContain("client.navigate(url.href)");
  });

  it("serves freshness control files without cache", () => {
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
