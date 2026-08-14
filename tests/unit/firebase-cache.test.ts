import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => [])
}));

const mockAuth = {};
const mockInitializeAuth = vi.fn(() => mockAuth);
const mockGetAuth = vi.fn(() => mockAuth);
const mockInMemoryPersistence = { type: 'NONE' };
const mockConnectAuthEmulator = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: mockGetAuth,
  initializeAuth: mockInitializeAuth,
  inMemoryPersistence: mockInMemoryPersistence,
  connectAuthEmulator: mockConnectAuthEmulator
}));

const mockFirestore = {};
const mockGetFirestore = vi.fn(() => mockFirestore);
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

  it('uses deterministic in-memory Auth and disables Firestore persistent cache in Emulator mode', async () => {
    await import('../../services/firebase');

    expect(mockInitializeAuth).toHaveBeenCalledWith(expect.anything(), {
      persistence: mockInMemoryPersistence
    });
    expect(mockGetAuth).not.toHaveBeenCalled();
    expect(mockConnectAuthEmulator).toHaveBeenCalled();

    expect(mockGetFirestore).toHaveBeenCalled();
    expect(mockInitializeFirestore).not.toHaveBeenCalled();
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(mockFirestore, '127.0.0.1', 8080);
  });
});
