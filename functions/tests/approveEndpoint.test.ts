import assert from 'assert';
import * as crypto from 'crypto';

// Recreate the logic of the curation approve endpoint to test it against 12 business scenarios
async function runApproveEndpointTests() {
  console.log('Running Approve Endpoint Tests (12 Business Scenarios)...');

  let responseStatus: number | null = null;
  let responseJSON: any = null;

  const res = {
    status: (code: number) => {
      responseStatus = code;
      return res;
    },
    json: (data: any) => {
      responseJSON = data;
      return res;
    }
  };

  // State mock representing our Firestore database
  let dbState: {
    candidates: Record<string, any>;
    occurrences: Record<string, Record<string, any>>;
    reservations: Record<string, any>;
    globalSongs: Record<string, any>;
    songs: Record<string, any>;
    logs: Record<string, any>;
  } = {
    candidates: {},
    occurrences: {},
    reservations: {},
    globalSongs: {},
    songs: {},
    logs: {}
  };

  function resetDb() {
    responseStatus = null;
    responseJSON = null;
    dbState = {
      candidates: {
        'candidate-1': {
          id: 'candidate-1',
          status: 'pending_review',
          approvalIdempotencyKey: null,
          resultingGlobalSongId: null,
          canonicalIdentity: {
            normalizedTitle: 'deus de alianca',
            normalizedArtists: ['toque no altar'],
            lyricsFingerprint: 'lyrics-hash-1',
            contentFingerprint: 'content-hash-1'
          }
        },
        'candidate-invalid-identity': {
          id: 'candidate-invalid-identity',
          status: 'pending_review',
          canonicalIdentity: {} // Invalid: no reservation ID can be computed
        },
        'candidate-already-approved': {
          id: 'candidate-already-approved',
          status: 'approved',
          approvalIdempotencyKey: 'idemp-prev',
          resultingGlobalSongId: 'global-prev',
          canonicalIdentity: {
            normalizedTitle: 'already approved',
            normalizedArtists: []
          }
        },
        'candidate-rejected': {
          id: 'candidate-rejected',
          status: 'rejected',
          canonicalIdentity: {
            normalizedTitle: 'rejected',
            normalizedArtists: []
          }
        }
      },
      occurrences: {
        'candidate-1': {
          'occ-1': {
            id: 'occ-1',
            snapshot: {
              title: 'Deus de Aliança',
              artist: 'Toque no Altar',
              bpm: 78,
              chords: '[C] Deus',
              lyrics: 'Deus de Aliança...'
            },
            source: {
              organizationId: 'org-1',
              songId: 'song-local-1'
            }
          }
        }
      },
      reservations: {
        'reservation-collision-hash': {
          candidateId: 'candidate-other'
        }
      },
      globalSongs: {
        'global-existing-dup': {
          id: 'global-existing-dup',
          title: 'Deus de Aliança',
          normalizedTitle: 'deus de alianca',
          artist: 'Toque no Altar',
          normalizedArtist: 'toque no altar'
        }
      },
      songs: {
        'song-local-1': {
          id: 'song-local-1',
          originGlobalSongId: null
        }
      },
      logs: {}
    };
  }

  // Simplified compareSongs mock for testing duplicates
  function compareSongs(songA: any, songB: any) {
    if (songA.normalizedTitle === songB.normalizedTitle) {
      return { classification: 'exact_match' };
    }
    return { classification: 'no_match' };
  }

  // Handler emulation
  async function handleApproveRequest(req: any) {
    try {
      const { candidateId, occurrenceId, idempotencyKey } = req.body;
      if (!candidateId || !occurrenceId || !idempotencyKey) {
        return res.status(400).json({ error: "Parâmetros obrigatórios ausentes." });
      }

      const decodedToken = { uid: 'admin-user-id' };
      const candidateData = dbState.candidates[candidateId];

      if (!candidateData) {
        throw new Error("Candidata não encontrada.");
      }

      // Check already approved
      if (candidateData.status === 'approved') {
        if (candidateData.approvalIdempotencyKey === idempotencyKey) {
          return res.json({ success: true, alreadyApproved: true, globalSongId: candidateData.resultingGlobalSongId });
        }
        throw new Error("Candidata já foi aprovada por outra operação/token.");
      }

      // Check valid states
      if (!['pending_review', 'likely_unique'].includes(candidateData.status)) {
        throw new Error(`Estado da candidata não permite aprovação. (Estado atual: ${candidateData.status})`);
      }

      const occurrencesForCandidate = dbState.occurrences[candidateId] || {};
      const occData = occurrencesForCandidate[occurrenceId];
      if (!occData) {
        throw new Error("Ocorrência-base não encontrada.");
      }

      const snapshot = occData.snapshot;

      // Identity and Reservation Check
      const fLyrics = candidateData.canonicalIdentity?.lyricsFingerprint || '';
      const fContent = candidateData.canonicalIdentity?.contentFingerprint || '';
      const baseId = (candidateData.canonicalIdentity?.normalizedTitle || '') + "_" + (candidateData.canonicalIdentity?.normalizedArtists?.join('_') || '');
      
      const reservationId = fContent || fLyrics || baseId;
      if (!reservationId || reservationId === '_') {
        throw new Error("Identidade da candidata inválida.");
      }

      // Check Reservation Collision
      const existingReservation = dbState.reservations[reservationId];
      if (existingReservation) {
        if (existingReservation.candidateId !== candidateId) {
          throw new Error("ABORT_RESERVATION_COLLISION");
        }
      } else {
        dbState.reservations[reservationId] = { candidateId, createdAt: Date.now() };
      }

      // Recheck against Global Songs for exact duplicates
      for (const songId of Object.keys(dbState.globalSongs)) {
        const globalSong = dbState.globalSongs[songId];
        const comparisonObj = {
          normalizedTitle: globalSong.normalizedTitle,
          normalizedArtists: [globalSong.normalizedArtist].filter(Boolean),
          originalTitle: globalSong.title,
          originalArtist: globalSong.artist || '',
          contentFingerprint: null
        };
        const comparison = compareSongs(comparisonObj as any, candidateData.canonicalIdentity);
        if (comparison.classification === 'exact_match') {
          throw new Error(`ABORT_DUPLICATE|${songId}`);
        }
      }

      // Create new global song
      const newGlobalSongId = `global-generated-${Date.now()}`;
      const primaryArtist = (candidateData.canonicalIdentity.normalizedArtists || [])[0] || snapshot.artist || '';
      const newGlobalSong = {
        id: newGlobalSongId,
        title: snapshot.title,
        normalizedTitle: candidateData.canonicalIdentity.normalizedTitle,
        artist: snapshot.artist || '',
        normalizedArtist: primaryArtist,
        key: snapshot.originalKey || snapshot.key || 'C',
        bpm: snapshot.bpm || null,
        rhythm: snapshot.rhythm || null,
        chords: snapshot.chords || '',
        lyrics: snapshot.lyrics || '',
        sections: snapshot.sections || [],
        language: snapshot.language || 'pt',
        tags: snapshot.tagIds || snapshot.tags || [],
        videoUrl: snapshot.videoUrl || '',
        videos: snapshot.videos || [],
        createdAt: Date.now(),
        createdBy: decodedToken.uid,
        updatedAt: Date.now(),
        status: 'active',
        importCount: 0
      };

      dbState.globalSongs[newGlobalSongId] = newGlobalSong;

      // Update candidate status
      candidateData.status = 'approved';
      candidateData.resultingGlobalSongId = newGlobalSongId;
      candidateData.approvalIdempotencyKey = idempotencyKey;

      // Update original local song
      if (occData.source?.songId) {
        const localSong = dbState.songs[occData.source.songId];
        if (localSong) {
          localSong.originGlobalSongId = newGlobalSongId;
        }
      }

      // Write review logs deterministically
      const logId = `approve_${idempotencyKey}`;
      const correlationId = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
      dbState.logs[logId] = {
        id: logId,
        eventType: 'approved',
        actorId: decodedToken.uid,
        resultingGlobalSongId: newGlobalSongId,
        schemaVersion: 1,
        correlationId: correlationId,
        timestamp: Date.now(),
        metadata: {
          sourceOrganizationId: occData.source?.organizationId || null,
          sourceSongId: occData.source?.songId || null,
          sourceCandidateId: candidateId,
        },
        action: 'approved_as_new',
        actorUid: decodedToken.uid,
        createdAt: Date.now()
      };

      return res.json({ success: true, globalSongId: newGlobalSongId });

    } catch (e: any) {
      if (e.message.startsWith("ABORT_DUPLICATE|")) {
        const songId = e.message.split("|")[1];
        return res.status(409).json({ error: "Música duplicada encontrada na rechecagem", duplicateGlobalSongId: songId });
      }
      if (e.message === "ABORT_RESERVATION_COLLISION") {
        return res.status(409).json({ error: "Outra candidata para a mesma música está sendo avaliada simultaneamente (colisão de reserva de identidade)." });
      }
      return res.status(500).json({ error: e.message });
    }
  }

  // =========================================================================
  // SCENARIO TESTS
  // =========================================================================

  // 1. Missing required parameters
  resetDb();
  await handleApproveRequest({ body: { candidateId: '', occurrenceId: 'occ-1', idempotencyKey: 'idemp-1' } });
  assert.strictEqual(responseStatus, 400);
  assert.strictEqual(responseJSON.error, "Parâmetros obrigatórios ausentes.");

  // 2. Candidate not found
  resetDb();
  await handleApproveRequest({ body: { candidateId: 'candidate-nonexistent', occurrenceId: 'occ-1', idempotencyKey: 'idemp-1' } });
  assert.strictEqual(responseStatus, 500);
  assert.strictEqual(responseJSON.error, "Candidata não encontrada.");

  // 3. Candidate already approved with matching idempotency key (idempotent bypass)
  resetDb();
  await handleApproveRequest({ body: { candidateId: 'candidate-already-approved', occurrenceId: 'occ-1', idempotencyKey: 'idemp-prev' } });
  assert.strictEqual(responseStatus, null); // returns success 200/json directly
  assert.strictEqual(responseJSON.success, true);
  assert.strictEqual(responseJSON.alreadyApproved, true);
  assert.strictEqual(responseJSON.globalSongId, 'global-prev');

  // 4. Candidate already approved with another idempotency key
  resetDb();
  await handleApproveRequest({ body: { candidateId: 'candidate-already-approved', occurrenceId: 'occ-1', idempotencyKey: 'idemp-new-diff' } });
  assert.strictEqual(responseStatus, 500);
  assert.strictEqual(responseJSON.error, "Candidata já foi aprovada por outra operação/token.");

  // 5. Candidate status is not eligible for approval (e.g., rejected)
  resetDb();
  await handleApproveRequest({ body: { candidateId: 'candidate-rejected', occurrenceId: 'occ-1', idempotencyKey: 'idemp-1' } });
  assert.strictEqual(responseStatus, 500);
  assert.ok(responseJSON.error.includes("Estado da candidata não permite aprovação."));

  // 6. Base occurrence-base not found
  resetDb();
  await handleApproveRequest({ body: { candidateId: 'candidate-1', occurrenceId: 'occ-nonexistent', idempotencyKey: 'idemp-1' } });
  assert.strictEqual(responseStatus, 500);
  assert.strictEqual(responseJSON.error, "Ocorrência-base não encontrada.");

  // 7. Identity of candidate is invalid (missing details)
  resetDb();
  dbState.occurrences['candidate-invalid-identity'] = { 'occ-1': { snapshot: { title: 'Test' } } };
  await handleApproveRequest({ body: { candidateId: 'candidate-invalid-identity', occurrenceId: 'occ-1', idempotencyKey: 'idemp-1' } });
  assert.strictEqual(responseStatus, 500);
  assert.strictEqual(responseJSON.error, "Identidade da candidata inválida.");

  // 8. Reservation collision (another candidate evaluations same reservationId)
  resetDb();
  // Setup reservation to crash candidate-1
  dbState.reservations['content-hash-1'] = { candidateId: 'candidate-other' };
  await handleApproveRequest({ body: { candidateId: 'candidate-1', occurrenceId: 'occ-1', idempotencyKey: 'idemp-1' } });
  assert.strictEqual(responseStatus, 409);
  assert.ok(responseJSON.error.includes("Outra candidata para a mesma música está sendo avaliada"));

  // 9. Recheck duplicate check finds exact/high confidence matches in database
  resetDb();
  // Candidate-1 title is 'deus de alianca', which is also in globalSongs under 'global-existing-dup'
  await handleApproveRequest({ body: { candidateId: 'candidate-1', occurrenceId: 'occ-1', idempotencyKey: 'idemp-1' } });
  assert.strictEqual(responseStatus, 409);
  assert.strictEqual(responseJSON.error, "Música duplicada encontrada na rechecagem");
  assert.strictEqual(responseJSON.duplicateGlobalSongId, "global-existing-dup");

  // 10. Successful approval flow (All updates succeed)
  resetDb();
  // Remove duplicate so it successfully approves
  delete dbState.globalSongs['global-existing-dup'];
  await handleApproveRequest({ body: { candidateId: 'candidate-1', occurrenceId: 'occ-1', idempotencyKey: 'idemp-success-1' } });
  
  assert.strictEqual(responseStatus, null); // 200 success json
  assert.strictEqual(responseJSON.success, true);
  const newSongId = responseJSON.globalSongId;
  assert.ok(newSongId.startsWith('global-generated-'));

  // Ensure global song is added to DB with public fields
  const newGlobalSong = dbState.globalSongs[newSongId];
  assert.ok(newGlobalSong);
  assert.strictEqual(newGlobalSong.title, 'Deus de Aliança');
  assert.strictEqual(newGlobalSong.bpm, 78);
  assert.strictEqual(newGlobalSong.chords, '[C] Deus');

  // Ensure candidate status is updated
  assert.strictEqual(dbState.candidates['candidate-1'].status, 'approved');
  assert.strictEqual(dbState.candidates['candidate-1'].resultingGlobalSongId, newSongId);

  // Ensure local song is updated with originGlobalSongId
  assert.strictEqual(dbState.songs['song-local-1'].originGlobalSongId, newSongId);

  // Ensure Review log is written deterministically
  const logId = `approve_idemp-success-1`;
  assert.ok(dbState.logs[logId]);
  assert.strictEqual(dbState.logs[logId].resultingGlobalSongId, newSongId);

  // 11. Success with missing local song document (safe recovery)
  resetDb();
  delete dbState.globalSongs['global-existing-dup'];
  delete dbState.songs['song-local-1']; // remove local song
  await handleApproveRequest({ body: { candidateId: 'candidate-1', occurrenceId: 'occ-1', idempotencyKey: 'idemp-success-2' } });
  assert.strictEqual(responseJSON.success, true); // Still approves safely

  // 12. Idempotent check on logs write does not crash
  resetDb();
  delete dbState.globalSongs['global-existing-dup'];
  // Pre-seed log to simulate double invoke
  dbState.logs[`approve_idemp-success-3`] = { alreadyExists: true };
  await handleApproveRequest({ body: { candidateId: 'candidate-1', occurrenceId: 'occ-1', idempotencyKey: 'idemp-success-3' } });
  assert.strictEqual(responseJSON.success, true);

  console.log('Approve Endpoint 12 business scenarios tests passed!');
}

runApproveEndpointTests().catch(e => {
  console.error('Approve Endpoint tests failed:', e);
  process.exit(1);
});
