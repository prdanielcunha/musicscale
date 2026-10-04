import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PWA release freshness guard", () => {
  const indexSource = readFileSync("index.tsx", "utf8");
  const viteSource = readFileSync("vite.config.ts", "utf8");

  it("checks for a new service worker during long-lived sessions", () => {
    expect(indexSource).toContain("navigator.serviceWorker.getRegistration()");
    expect(indexSource).toContain("registration.update()");
    expect(indexSource).toContain("SW_UPDATE_CHECK_INTERVAL_MS");
    expect(indexSource).toContain("30 * 1000");
    expect(indexSource).toContain("visibilitychange");
    expect(indexSource).toContain("window.addEventListener('focus'");
    expect(indexSource).toContain("window.addEventListener('online'");
    expect(indexSource).toContain("document.visibilityState !== 'visible'");
  });

  it("surfaces a visible update action when the active worker changes", () => {
    expect(indexSource).toContain("controllerchange");
    expect(indexSource).toContain("musicscale-update-available");
    expect(indexSource).toContain("Nova versão do MusicScale disponível");
    expect(indexSource).toContain("window.location.reload()");
  });

  it("activates fresh workers and removes obsolete caches", () => {
    expect(viteSource).toContain("cleanupOutdatedCaches: true");
    expect(viteSource).toContain("clientsClaim: true");
    expect(viteSource).toContain("skipWaiting: true");
  });
});
