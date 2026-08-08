import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn()
}));

const mockGetFirestore = vi.fn();
const mockInitializeFirestore = vi.fn();
const mockPersistentLocalCache = vi.fn(() => 'mock-local-cache');
const mockPersistentMultipleTabManager = vi.fn(() => 'mock-tab-manager');
const mockConnectFirestoreEmulator = vi.fn();

vi.mock('firebase/firestore', () => ({
  getFirestore: mockGetFirestore,
  initializeFirestore: mockInitializeFirestore,
  persistentLocalCache: mockPersistentLocalCache,
  persistentMultipleTabManager: mockPersistentMultipleTabManager,
  connectFirestoreEmulator: mockConnectFirestoreEmulator
}));

vi.mock('../../services/firebaseRuntimeConfig', () => ({
  getFirebaseRuntimeConfig: vi.fn(() => ({
    firebaseConfig: { firestoreDatabaseId: 'mock-db' },
    useEmulators: true
  }))
}));

describe('Firebase Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should disable persistent cache in Emulator mode', async () => {
    // We mock useEmulators: true above
    await import('../../services/firebase');
    
    // getFirestore should have been called (which means no persistent cache)
    expect(mockGetFirestore).toHaveBeenCalled();
    // initializeFirestore with persistentLocalCache should NOT have been called
    expect(mockInitializeFirestore).not.toHaveBeenCalled();
  });
});
