import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PWA release freshness guard", () => {
  const indexSource = readFileSync("index.tsx", "utf8");
  const viteSource = readFileSync("vite.config.ts", "utf8");
  const firebaseSource = readFileSync("firebase.json", "utf8");

  it("checks a published version manifest during long-lived sessions", () => {
    expect(indexSource).toContain("VERSION_MANIFEST_PATH = '/version.json'");
    expect(indexSource).toContain("VERSION_CHECK_INTERVAL_MS = 30 * 1000");
    expect(indexSource).toContain("cache: 'no-store'");
    expect(indexSource).toContain("manifest.version !== APP_BUILD_VERSION");
    expect(indexSource).toContain("document.addEventListener('visibilitychange'");
    expect(indexSource).toContain("window.addEventListener('focus'");
    expect(indexSource).toContain("window.addEventListener('online'");
  });

  it("keeps service worker refresh as a second independent update signal", () => {
    expect(indexSource).toContain("navigator.serviceWorker.getRegistration()");
    expect(indexSource).toContain("registration.update()");
    expect(indexSource).toContain("controllerchange");
    expect(indexSource).toContain("hasActiveController");
  });

  it("surfaces a visible action and can escape a stale iOS worker before reload", () => {
    expect(indexSource).toContain("musicscale-update-available");
    expect(indexSource).toContain("Nova versão do MusicScale disponível");
    expect(indexSource).toContain("registration.unregister()");
    expect(indexSource).toContain("window.location.replace");
  });

  it("emits version.json outside the service-worker precache", () => {
    expect(viteSource).toContain("musicscale-version-manifest");
    expect(viteSource).toContain("fileName: 'version.json'");
    expect(viteSource).toContain("globIgnores: ['version.json']");
  });

  it("serves the published version manifest without cache", () => {
    expect(firebaseSource).toContain('"source": "/version.json"');
    expect(firebaseSource).toContain('"value": "no-cache,no-store,must-revalidate"');
  });

  it("activates fresh workers and removes obsolete caches", () => {
    expect(viteSource).toContain("cleanupOutdatedCaches: true");
    expect(viteSource).toContain("clientsClaim: true");
    expect(viteSource).toContain("skipWaiting: true");
  });
});
