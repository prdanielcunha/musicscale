import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => [])
}));

const mockOnAuthStateChanged = vi.fn((_auth, callback) => {
  callback({ uid: 'e2e-user' });
  return vi.fn();
});

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: mockOnAuthStateChanged
}));

const mockFirestoreInstance = { id: 'mock-firestore' };
const mockGetFirestore = vi.fn(() => mockFirestoreInstance);
const mockInitializeFirestore = vi.fn();
const mockPersistentLocalCache = vi.fn(() => 'mock-local-cache');
const mockPersistentMultipleTabManager = vi.fn(() => 'mock-tab-manager');
const mockConnectFirestoreEmulator = vi.fn();
const mockDoc = vi.fn((_db, ...segments) => segments.join('/'));
const mockOnSnapshot = vi.fn(() => vi.fn());

vi.mock('firebase/firestore', () => ({
  getFirestore: mockGetFirestore,
  initializeFirestore: mockInitializeFirestore,
  persistentLocalCache: mockPersistentLocalCache,
  persistentMultipleTabManager: mockPersistentMultipleTabManager,
  connectFirestoreEmulator: mockConnectFirestoreEmulator,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot
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
    delete (globalThis as any).__FIREBASE_EMULATORS_CONNECTED__;
    delete (globalThis as any).__MUSICSCALE_E2E_FIRESTORE_BOOTSTRAP__;
  });

  it('should disable persistent cache in Emulator mode and keep the bootstrap user listener alive', async () => {
    await import('../../services/firebase');

    expect(mockGetFirestore).toHaveBeenCalled();
    expect(mockInitializeFirestore).not.toHaveBeenCalled();

    expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(mockFirestoreInstance, 'users', 'e2e-user');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });
});
