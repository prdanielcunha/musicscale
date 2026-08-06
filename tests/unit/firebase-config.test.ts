import { describe, it, expect } from 'vitest';
import { getFirebaseRuntimeConfig } from '../../services/firebaseRuntimeConfig';

describe('Firebase E2E Config', () => {
  const prodConfig = { projectId: 'prod-id' };

  it('should use prod config if E2E mode is false', () => {
    const res = getFirebaseRuntimeConfig({
      prodConfig,
      isDev: true,
      viteE2eMode: 'false',
      viteE2eProjectId: 'demo-musicscale',
      hostname: 'localhost'
    });
    expect(res.useEmulators).toBe(false);
    expect(res.projectId).toBe('prod-id');
  });

  it('should throw if E2E mode is true but not localhost', () => {
    expect(() => getFirebaseRuntimeConfig({
      prodConfig,
      isDev: true,
      viteE2eMode: 'true',
      viteE2eProjectId: 'demo-musicscale',
      hostname: 'example.com'
    })).toThrowError(/localhost/);
  });

  it('should throw if E2E mode is true but not DEV', () => {
    expect(() => getFirebaseRuntimeConfig({
      prodConfig,
      isDev: false,
      viteE2eMode: 'true',
      viteE2eProjectId: 'demo-musicscale',
      hostname: 'localhost'
    })).toThrowError(/DEV mode/);
  });

  it('should throw if E2E mode is true but projectId is not demo-musicscale', () => {
    expect(() => getFirebaseRuntimeConfig({
      prodConfig,
      isDev: true,
      viteE2eMode: 'true',
      viteE2eProjectId: 'other-id',
      hostname: 'localhost'
    })).toThrowError(/demo-musicscale/);
  });

  it('should throw if E2E mode is true but projectId is missing', () => {
    expect(() => getFirebaseRuntimeConfig({
      prodConfig,
      isDev: true,
      viteE2eMode: 'true',
      viteE2eProjectId: undefined,
      hostname: 'localhost'
    })).toThrowError(/VITE_E2E_FIREBASE_PROJECT_ID/);
  });

  it('should use emulator config if valid', () => {
    const res = getFirebaseRuntimeConfig({
      prodConfig,
      isDev: true,
      viteE2eMode: 'true',
      viteE2eProjectId: 'demo-musicscale',
      hostname: 'localhost'
    });
    expect(res.useEmulators).toBe(true);
    expect(res.projectId).toBe('demo-musicscale');
    expect(res.firebaseConfig.authDomain).toBe('demo-musicscale.firebaseapp.com');
  });
});
