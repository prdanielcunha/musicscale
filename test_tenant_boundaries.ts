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
