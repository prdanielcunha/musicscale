import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('mobile startup P0 contract', () => {
  it('keeps the private application behind the startup interaction boundary', () => {
    const app = read('App.tsx');
    expect(app).toContain("./components/bootstrap/StartupInteractionBoundary");
    expect(app).toContain('<StartupInteractionBoundary>');
    expect(app).toContain('<PrivateApp />');
  });

  it('warms the scale-to-zero critical API only for returning compact touch sessions', () => {
    const boundary = read('components/bootstrap/StartupInteractionBoundary.tsx');
    expect(boundary).toContain("activeOrganizationId");
    expect(boundary).toContain("(max-width: 1024px)");
    expect(boundary).toContain("(pointer: coarse)");
    expect(boundary).toContain("connection?.saveData");
    expect(boundary).toContain("method: 'HEAD'");
    expect(boundary).toContain('/api/v1/ecosystem/access-context?organizationId=__startup_warmup__');
    expect(boundary).toContain('critical_api_warmup_started_ms');
  });

  it('consumes startup touches instead of allowing delayed ghost actions', () => {
    const boundary = read('components/bootstrap/StartupInteractionBoundary.tsx');
    const entry = read('index.tsx');

    expect(boundary).toContain('startup-interaction-shield');
    expect(boundary).toContain("touchAction: 'none'");
    expect(boundary).toContain('event.preventDefault()');
    expect(boundary).toContain('event.stopPropagation()');
    expect(boundary).toContain('onPointerDown={swallowStartupInteraction}');
    expect(boundary).toContain('onTouchStart={swallowStartupInteraction}');
    expect(boundary).toContain('onClick={swallowStartupInteraction}');

    expect(entry).toContain('function swallowStartupInteraction');
    expect(entry).toContain('onPointerDown={swallowStartupInteraction}');
    expect(entry).toContain('onTouchStart={swallowStartupInteraction}');
  });

  it('does not declare the private shell interactive before auth and gateway readiness', () => {
    const boundary = read('components/bootstrap/StartupInteractionBoundary.tsx');
    const gateway = read('pages/StartGateway.tsx');

    expect(boundary).toContain("auth_profile_completed_ms");
    expect(boundary).toContain("location.pathname === '/start' && !startGatewayReady");
    expect(boundary).toContain("first_interactive_ms");
    expect(gateway).toContain("musicscale:startup-interactive-ready");
    expect(gateway).toContain('isWaitingForOrganizationHydration');
    expect(gateway).toContain('isStartupInteractiveReady');
  });
});
