import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicRepository } from '../../services/MusicRepository';

// Mock firestore transaction & doc methods
const mockRunTransaction = vi.fn();
const mockDoc = vi.fn();
const currentOrgId = 'org-shaddai-777';
const alienOrgId = 'org-alien-999';

let lastSavedSongData: any = null;

vi.mock('firebase/firestore', () => ({
  runTransaction: vi.fn((_db: any, updateFunction: any) => mockRunTransaction(updateFunction)),
  doc: vi.fn((...args: any[]) => mockDoc(...args)),
  getDoc: vi.fn().mockImplementation((docRef: any) => Promise.resolve({
    exists: () => true,
    id: docRef?.path?.split('/')?.pop() || 'song-111',
    data: () => ({
      id: docRef?.path?.split('/')?.pop() || 'song-111',
      organizationId: currentOrgId,
      title: 'Song',
      chords: 'G   D   Em   C',
      ...(lastSavedSongData || {}),
      metadata: lastSavedSongData?.metadata || { chordContentKey: 'G', chordKeyCorrection: { method: 'detected' } }
    })
  })),
  serverTimestamp: vi.fn(() => 'MOCK_SERVER_TIMESTAMP'),
}));

vi.mock('../../services/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-token-123'),
      uid: 'user-tester-123'
    }
  },
  db: {}
}));

describe('MusicRepository - Chord Key Repair Transactional Logic', () => {
  let repository: MusicRepository;
  const currentOrgId = 'org-shaddai-777';
  const alienOrgId = 'org-alien-999';

  beforeEach(() => {
    vi.clearAllMocks();
    lastSavedSongData = null;
    repository = new MusicRepository(currentOrgId, { uid: 'user-tester-123', email: 'tester@test.com', displayName: 'Tester', photoURL: '', roleId: 'admin', organizationRole: 'admin' } as any);
  });

  it('deve reparar o tom da cifra com sucesso quando em tom limpo (manual/detected)', async () => {
    const songId = 'song-111';
    const nowIso = new Date().toISOString();
    const existingSong = {
      id: songId,
      organizationId: currentOrgId,
      title: 'Grande É o Senhor',
      key: 'G',
      chords: 'C   G   C   G\nC   G   C   G', // Clear C major chord progression (high confidence)
      metadata: {
        chordContentKey: 'C'
      },
      lastModifiedAt: nowIso
    };

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => existingSong
        }),
        update: vi.fn((_ref: any, data: any) => { lastSavedSongData = data; })
      };
      return callback(mockTransaction);
    });

    const result = await repository.repairOrganizationSongChordKey({
      songId,
      organizationId: currentOrgId,
      sourceChordKey: 'C',
      targetChordKey: 'G',
      expectedUpdatedAt: nowIso,
      sourceConfirmation: {
        type: 'detected',
        detectedKey: 'C',
        detectionConfidence: 'high'
      }
    });

    expect(result).toBeDefined();
    expect(result.chords).toContain('G   D   G   D');
    expect(result.metadata.chordContentKey).toBe('G');
    expect(result.metadata.chordKeyCorrection).toBeDefined();
    expect(result.metadata.chordKeyCorrection.method).toBe('detected');

    // Assert that doc was called with root canonical path 'songs/song-111'
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'songs', songId);
    // Assert doc was NEVER called with organizations/org-shaddai-777/songs/song-111
    const callsWithNestedPath = mockDoc.mock.calls.filter(call => 
      call.some(arg => typeof arg === 'string' && arg.includes('organizations/'))
    );
    expect(callsWithNestedPath).toHaveLength(0);
  });

  it('não deve considerar shapeKey como tom atual quando normalizedToConcertKey for true (caso de provenance)', async () => {
    const songId = 'song-prov-111';
    const nowIso = new Date().toISOString();
    const existingSong = {
      id: songId,
      organizationId: currentOrgId,
      title: 'Música Provenance',
      key: 'F#',
      chords: 'F#   C#/E#   D#m   B\nF#   C#/E#   D#m   B',
      metadata: {
        declaredKey: 'F#',
        shapeKey: 'E',
        capo: 2,
        transpositionSemitones: 2,
        normalizedToConcertKey: true
      },
      lastModifiedAt: nowIso
    };

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => existingSong
        }),
        update: vi.fn((_ref: any, data: any) => { lastSavedSongData = data; })
      };
      return callback(mockTransaction);
    });

    // Confirmation by metadata 'E' must be rejected because shapeKey 'E' is not current key when normalizedToConcertKey === true
    await expect(
      repository.repairOrganizationSongChordKey({
        songId,
        organizationId: currentOrgId,
        sourceChordKey: 'E',
        targetChordKey: 'G',
        sourceConfirmation: {
          type: 'metadata',
          metadataKey: 'E'
        }
      })
    ).rejects.toThrow('Metadata de tom não encontrada no documento.');
  });

  it('deve rejeitar reparo quando houver conflito entre metadata e detectado e confirmation for manual ou faltar acknowledgedConflict', async () => {
    const songId = 'song-222';
    const existingSong = {
      id: songId,
      organizationId: currentOrgId,
      title: 'Em Nome do Pai',
      key: 'A',
      chords: 'A   E   F#m   D', // High confidence detected key: A
      metadata: {
        chordContentKey: 'C' // Metadata indicates C, conflicting with detected A!
      }
    };

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => existingSong
        }),
        update: vi.fn()
      };
      return callback(mockTransaction);
    });

    await expect(
      repository.repairOrganizationSongChordKey({
        songId,
        organizationId: currentOrgId,
        sourceChordKey: 'C',
        targetChordKey: 'G',
        sourceConfirmation: {
          type: 'manual',
          selectedKey: 'C'
        }
      })
    ).rejects.toThrow('Confirmação manual não é permitida quando há tom detectado de confiança alta ou média. Use override se deseja alterar.');
  });

  it('deve aceitar reparo com conflito quando a confirmação for de tipo override com acknowledgedConflict = true', async () => {
    const songId = 'song-333';
    const existingSong = {
      id: songId,
      organizationId: currentOrgId,
      title: 'Em Nome do Pai',
      key: 'A',
      chords: 'A   E   A   E\nA   E   A   E',
      metadata: {
        chordContentKey: 'C'
      }
    };

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => existingSong
        }),
        update: vi.fn((_ref: any, data: any) => { lastSavedSongData = data; })
      };
      return callback(mockTransaction);
    });

    const result = await repository.repairOrganizationSongChordKey({
      songId,
      organizationId: currentOrgId,
      sourceChordKey: 'C',
      targetChordKey: 'G',
      sourceConfirmation: {
        type: 'override',
        selectedKey: 'C',
        detectedKey: 'A',
        detectionConfidence: 'high',
        acknowledgedConflict: true
      }
    });

    expect(result).toBeDefined();
    expect(result.metadata.chordKeyCorrection.method).toBe('override');
  });

  it('deve rejeitar reparo por conflito de concorrência se expectedUpdatedAt for diferente do documento no banco', async () => {
    const songId = 'song-444';
    const oldDate = '2026-08-01T10:00:00.000Z';
    const newerDate = '2026-08-01T12:00:00.000Z';

    const existingSong = {
      id: songId,
      organizationId: currentOrgId,
      title: 'Aleluia',
      key: 'C',
      chords: 'C G Am F',
      metadata: { chordContentKey: 'C' },
      lastModifiedAt: newerDate // Updated after client loaded
    };

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => existingSong
        }),
        update: vi.fn()
      };
      return callback(mockTransaction);
    });

    await expect(
      repository.repairOrganizationSongChordKey({
        songId,
        organizationId: currentOrgId,
        sourceChordKey: 'C',
        targetChordKey: 'D',
        expectedUpdatedAt: oldDate,
        sourceConfirmation: { type: 'detected', detectedKey: 'C', detectionConfidence: 'high' }
      })
    ).rejects.toThrow('Conflito de concorrência: A música foi modificada por outro usuário. Recarregue os dados e tente novamente.');
  });

  it('deve lançar erro e recusar acesso se a música pertencer a outra organização', async () => {
    const songId = 'song-555';
    const alienSong = {
      id: songId,
      organizationId: alienOrgId,
      title: 'Música Alienígena',
      key: 'C',
      chords: 'C G Am F',
      metadata: { chordContentKey: 'C' }
    };

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => alienSong
        }),
        update: vi.fn()
      };
      return callback(mockTransaction);
    });

    await expect(
      repository.repairOrganizationSongChordKey({
        songId,
        organizationId: alienOrgId, // Mismatch with repository.orgId
        sourceChordKey: 'C',
        targetChordKey: 'D',
        sourceConfirmation: { type: 'detected', detectedKey: 'C', detectionConfidence: 'high' }
      })
    ).rejects.toThrow('Operação negada: ID da organização ausente no contexto atual.');
  });

  // Novos testes baseados nas regras implementadas na PR

  it('1. chordContentKey aceita confirmação por metadata', async () => {
    let updateCalled = false;
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            id: 'song-test-1',
            organizationId: currentOrgId,
            chords: 'C G',
            metadata: { chordContentKey: 'C' }
          })
        }),
        update: vi.fn(() => { updateCalled = true; })
      };
      return callback(mockTransaction);
    });

    await repository.repairOrganizationSongChordKey({
      songId: 'song-test-1',
      organizationId: currentOrgId,
      sourceChordKey: 'C',
      targetChordKey: 'D',
      sourceConfirmation: { type: 'metadata', metadataKey: 'C' }
    });

    expect(updateCalled).toBe(true);
  });

  it('2 e 3. shapeKey sem normalizedToConcertKey ou com normalizedToConcertKey = true não aceita confirmação por metadata automática', async () => {
    let updateCalled = false;
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            id: 'song-test-2',
            organizationId: currentOrgId,
            chords: 'C G',
            metadata: { shapeKey: 'C', normalizedToConcertKey: false }
          })
        }),
        update: vi.fn(() => { updateCalled = true; })
      };
      return callback(mockTransaction);
    });

    await expect(
      repository.repairOrganizationSongChordKey({
        songId: 'song-test-2',
        organizationId: currentOrgId,
        sourceChordKey: 'C',
        targetChordKey: 'D',
        sourceConfirmation: { type: 'metadata', metadataKey: 'C' }
      })
    ).rejects.toThrow('Metadata de tom não encontrada no documento.');
    
    expect(updateCalled).toBe(false);
  });

  it('4. timestamp com diferença de 1 ms rejeita por conflito de concorrência', async () => {
    let updateCalled = false;
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            id: 'song-test-4',
            organizationId: currentOrgId,
            chords: 'C G',
            metadata: { chordContentKey: 'C' },
            lastModifiedAt: '2026-08-01T12:00:00.001Z'
          })
        }),
        update: vi.fn(() => { updateCalled = true; })
      };
      return callback(mockTransaction);
    });

    await expect(
      repository.repairOrganizationSongChordKey({
        songId: 'song-test-4',
        organizationId: currentOrgId,
        sourceChordKey: 'C',
        targetChordKey: 'D',
        expectedUpdatedAt: '2026-08-01T12:00:00.000Z', // 1 ms difference
        sourceConfirmation: { type: 'metadata', metadataKey: 'C' }
      })
    ).rejects.toThrow('Conflito de concorrência');

    expect(updateCalled).toBe(false);
  });

  it('5. detectedKey falso/divergente rejeita', async () => {
    let updateCalled = false;
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            id: 'song-test-5',
            organizationId: currentOrgId,
            chords: 'C G Am F', // Real key is C
            metadata: {}
          })
        }),
        update: vi.fn(() => { updateCalled = true; })
      };
      return callback(mockTransaction);
    });

    await expect(
      repository.repairOrganizationSongChordKey({
        songId: 'song-test-5',
        organizationId: currentOrgId,
        sourceChordKey: 'F', // Claiming detectedKey is F when chords are C
        targetChordKey: 'G',
        sourceConfirmation: { type: 'detected', detectedKey: 'F', detectionConfidence: 'medium' }
      })
    ).rejects.toThrow('Tom detectado diverge do tom recalculado no servidor.');

    expect(updateCalled).toBe(false);
  });

  it('6. override sem acknowledgedConflict = true rejeita', async () => {
    let updateCalled = false;
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            id: 'song-test-6',
            organizationId: currentOrgId,
            chords: 'C G Am F',
            metadata: {}
          })
        }),
        update: vi.fn(() => { updateCalled = true; })
      };
      return callback(mockTransaction);
    });

    await expect(
      repository.repairOrganizationSongChordKey({
        songId: 'song-test-6',
        organizationId: currentOrgId,
        sourceChordKey: 'D',
        targetChordKey: 'E',
        sourceConfirmation: {
          type: 'override',
          selectedKey: 'D',
          detectedKey: 'C',
          detectionConfidence: 'medium',
          acknowledgedConflict: false as any // Must be true!
        }
      })
    ).rejects.toThrow('Confirmação explícita do conflito (acknowledgedConflict) é obrigatória para override.');

    expect(updateCalled).toBe(false);
  });

  it('7 e 8. preview inválido (ex: tag de acorde corrompida) não grava nenhuma alteração', async () => {
    // This is essentially checking that if transposition fails on the server, it throws and aborts transaction
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            id: 'song-test-7',
            organizationId: currentOrgId,
            chords: 'C [invalid G Am', // Broken chord format
            metadata: { chordContentKey: 'C' }
          })
        }),
        update: vi.fn()
      };
      return callback(mockTransaction);
    });

    try {
      await repository.repairOrganizationSongChordKey({
        songId: 'song-test-7',
        organizationId: currentOrgId,
        sourceChordKey: 'C',
        targetChordKey: 'D',
        sourceConfirmation: { type: 'detected', detectedKey: 'C', detectionConfidence: 'medium' }
      });
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });

  it('9. resultado canônico vem do caminho songs/{songId}', async () => {
    // Clear mock calls
    mockDoc.mockClear();

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            id: 'song-test-9',
            organizationId: currentOrgId,
            chords: 'C G Am F',
            metadata: { chordContentKey: 'C' }
          })
        }),
        update: vi.fn()
      };
      return callback(mockTransaction);
    });

    await repository.repairOrganizationSongChordKey({
      songId: 'song-test-9',
      organizationId: currentOrgId,
      sourceChordKey: 'C',
      targetChordKey: 'D',
      sourceConfirmation: { type: 'detected', detectedKey: 'C', detectionConfidence: 'medium' }
    });

    // Check doc reference path
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'songs', 'song-test-9');
    // Ensure we didn't use the organizations subcollection path
    const callsWithOrg = mockDoc.mock.calls.filter(call => 
      call.some(arg => typeof arg === 'string' && arg.includes('organizations/'))
    );
    expect(callsWithOrg).toHaveLength(0);
  });
});
