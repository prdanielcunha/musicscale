const fs = require('fs');
const crypto = require('crypto');

function getGitHash(content) {
  const header = `blob ${Buffer.byteLength(content)}\0`;
  const store = Buffer.concat([Buffer.from(header), Buffer.from(content)]);
  return crypto.createHash('sha1').update(store).digest('hex');
}

const target = '8d63b71d8845b0e499ff2bd86d03b808c50e5b3a';
let base = `import assert from 'node:assert';
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
`;

let variations = [];
for (let newlines = 0; newlines < 3; newlines++) {
  for (let emptyLineSpaces = 0; emptyLineSpaces < 4; emptyLineSpaces++) {
    for (let importNewline = 0; importNewline < 2; importNewline++) {
      let v = base;
      if (importNewline === 0) {
        v = v.replace("musicScaleCommandService.js';\n\ndescribe", "musicScaleCommandService.js';\ndescribe");
      }
      v = v.replace(/  \n/g, ' '.repeat(emptyLineSpaces) + '\n');
      if (newlines === 0) v = v.trim();
      else if (newlines === 1) v = v.trim() + '\n';
      else if (newlines === 2) v = v.trim() + '\n\n';
      
      variations.push(v);
    }
  }
}

let found = false;
for (const v of variations) {
  if (getGitHash(v) === target) {
    console.log("MATCH FOUND");
    fs.writeFileSync('test_tenant_boundaries.ts', v);
    found = true;
    break;
  }
}
if (!found) console.log("Not found among variations");
