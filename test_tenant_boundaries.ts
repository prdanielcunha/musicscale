import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { buildEffectiveAccessContext, hasMusicScaleCapability } from './utils/rbac.js';
import { MusicScaleCommandService } from './services/server/scale/musicScaleCommandService.js';

describe('RBAC & Authorization Boundaries', () => {
  it('Global Admin should have scales.publish capability', () => {
    const ctx = buildEffectiveAccessContext('u1', 'o1', 'global_admin', null, 'active');
    assert.strictEqual(ctx.isGlobalAccess, true);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'scales.publish'), true);
  });
  
  it('Ecosystem Support has scoped cross-tenant MusicScale access without organization governance', () => {
    const ctx = buildEffectiveAccessContext('support-1', 'o1', 'ecosystem_support', null, 'active');
    assert.strictEqual(ctx.isGlobalAccess, true);
    assert.strictEqual(ctx.isGlobalFullAccess, false);
    assert.strictEqual(ctx.isOrganizationAdmin, false);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'scales.publish'), true);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'songs.update'), true);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'organization.members.manage'), false);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'organization.settings.manage'), false);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'musicScale.fullAccess'), false);
  });

  it('Local owner systemRole must not become ecosystem authority', () => {
    const ctx = buildEffectiveAccessContext('local-owner', 'o2', 'owner', null, 'active');
    assert.strictEqual(ctx.isGlobalAccess, false);
    assert.strictEqual(ctx.resolutionStatus, 'incomplete');
  });

  it('Legacy admin preserves global_admin compatibility', () => {
    const ctx = buildEffectiveAccessContext('legacy-admin', 'o1', 'admin', null, 'active');
    assert.strictEqual(ctx.isGlobalAccess, true);
    assert.strictEqual(ctx.systemRole, 'global_admin');
    assert.strictEqual(ctx.isGlobalFullAccess, true);
  });

  it('Owner should have scales.publish capability', () => {
    const ctx = buildEffectiveAccessContext('u2', 'o1', null, 'owner', 'active');
    assert.strictEqual(ctx.isGlobalAccess, false);
    assert.strictEqual(ctx.isOrganizationAdmin, true);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'scales.publish'), true);
  });
  
  it('Member (active) should NOT have scales.publish capability', () => {
    const ctx = buildEffectiveAccessContext('u3', 'o1', null, 'member', 'active');
    assert.strictEqual(ctx.isGlobalAccess, false);
    assert.strictEqual(hasMusicScaleCapability(ctx, 'scales.publish'), false);
  });
});
