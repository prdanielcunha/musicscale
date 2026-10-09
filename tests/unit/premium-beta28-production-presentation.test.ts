import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
const vite=fs.readFileSync('vite.config.ts','utf8');
const live=fs.readFileSync('.github/workflows/firebase-production-deploy.yml','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const notes=fs.readFileSync('ops/hosting-release.txt','utf8');

describe('Beta.28 visual-only production release',()=>{
  it('never advertises performance tools to tenants without the required capability',()=>{
    const home=fs.readFileSync('pages/DashboardPage.tsx','utf8');
    const routes=fs.readFileSync('PrivateApp.tsx','utf8');
    expect(home).toContain('const quickTools = premiumDashboard && canUsePerformance');
    expect(routes).toContain('<ProtectedRoute requiredPermission="musicscale.performance.use">');
  });

  it('activates premium appearance strictly from official production Firebase workflow',()=>{
    expect(vite).toContain("process.env.GITHUB_WORKFLOW === 'MusicScale Firebase Production Deploy'");
    expect(vite).toContain("process.env.GITHUB_REF === 'refs/heads/production'");
    expect(vite).toContain("process.env.HOSTING_TARGET === 'musicscale'");
    expect(vite).toContain("process.env.MUSICSCALE_PREMIUM_PRESENTATION_ROLLOUT === 'true'");
    expect(vite).toContain('(isPremiumReviewBuild || isPremiumProductionBuild)');
    expect(live).toContain("MUSICSCALE_PREMIUM_PRESENTATION_ROLLOUT: 'true'");
    expect(live).toContain("branches: [ production ]");
    expect(live).toContain("paths:");
    expect(live).toContain("'ops/hosting-release.txt'");
  });
  it('does not enable or alter server grant or Stripe checkout flags',()=>{
    expect(live).not.toContain("MUSICSCALE_HUB_TRIAL_V2_ENABLED:");
    expect(live).not.toContain("MUSICSCALE_INTERNAL_TRIAL_ENABLED:");
    expect(vite).not.toContain("'import.meta.env.MUSICSCALE_HUB_TRIAL_V2_ENABLED'");
    expect(vite).not.toContain("'import.meta.env.MUSICSCALE_INTERNAL_TRIAL_ENABLED'");
    expect(live).not.toContain("stripe.checkout");
    expect(live).not.toContain("firebase deploy --only firestore");
  });
  it('keeps manifest, lockfile and release marker aligned for live smoke gate',()=>{
    expect(pkg.version).toBe('0.10.9-beta.28');
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[''].version).toBe(pkg.version);
    expect(notes.startsWith('MusicScale 0.10.9-beta.28')).toBe(true);
    expect(notes).toContain('Preserva beta.27 integralmente:');
  });
});