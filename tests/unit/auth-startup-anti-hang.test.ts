import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const authService = fs.readFileSync('services/authService.ts', 'utf8');
const loginPage = fs.readFileSync('pages/LoginPage.tsx', 'utf8');
const authContext = fs.readFileSync('contexts/AuthContext.tsx', 'utf8');
const ecosystemContext = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf8');

describe('P0 auth/startup anti-hang contract', () => {
  it('does not block a successful Google sign-in on Firestore profile hydration', () => {
    expect(authService).toContain('void (async () =>');
    expect(authService).toContain('Google sign-in succeeded; deferred profile sync');
    expect(authService.indexOf('return userCredential;')).toBeGreaterThan(
      authService.indexOf('void (async () =>')
    );
  });

  it('bounds the deferred auth chunk and Firebase login action', () => {
    expect(loginPage).toContain('LOGIN_RUNTIME_TIMEOUT_MS = 12000');
    expect(loginPage).toContain("import(\"../services/authService\")");
    expect(loginPage).toContain("withLoginTimeout(signInWithGoogle(), 'GOOGLE_SIGN_IN')");
  });

  it('bounds user profile hydration so AuthContext always reaches its finally path', () => {
    expect(authContext).toContain('AUTH_PROFILE_TIMEOUT_MS = 6000');
    expect(authContext).toContain('withAuthBootstrapTimeout(getDoc');
    expect(authContext).toContain("markStartupMetric('auth_profile_completed_ms')");
    expect(authContext).toContain('setLoading(false)');
  });

  it('bounds all parallel organization discovery queries instead of waiting forever', () => {
    expect(ecosystemContext).toContain('ECOSYSTEM_FIRESTORE_TIMEOUT_MS = 6000');
    expect(ecosystemContext).toContain("withEcosystemTimeout(getDocs(query(collection(db, 'organizations')");
    expect(ecosystemContext).toContain("withEcosystemTimeout(getDocs(query(collectionGroup(db, 'members')");
    expect(ecosystemContext).toContain('const results = await Promise.allSettled(queries)');
  });
});
