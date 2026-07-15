import { doc, getDoc as nativeGetDoc, runTransaction as nativeRunTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { Song, FreshnessStatus, FreshnessSource } from '../types';
import { evaluateSongFreshness, isValidDateOnly } from '../utils/songFreshnessEvaluation';

export const firestoreGateway = {
  getDoc: nativeGetDoc,
  runTransaction: nativeRunTransaction
};

export interface FreshnessExecutionInput {
  organizationId: string;
  songIds: string[];
  today: string;
  mode: 'dry-run' | 'apply';
}

export interface FreshnessExecutionItem {
  songId: string;
  currentStatus: 'new' | 'old' | 'default';
  currentSource: 'auto' | 'manual';
  shouldUpdate: boolean;
  nextStatus?: 'old' | 'new' | 'default';
  referenceDate?: string;
  expirationDate?: string;
  reason: string;
  outcome:
    | 'would-update'
    | 'updated'
    | 'unchanged'
    | 'missing'
    | 'wrong-organization'
    | 'invalid'
    | 'failed';
}

export interface FreshnessExecutionResult {
  mode: 'dry-run' | 'apply';
  requested: number;
  evaluated: number;
  wouldUpdate: number;
  updated: number;
  unchanged: number;
  missing: number;
  wrongOrganization: number;
  invalid: number;
  failed: number;
  items: FreshnessExecutionItem[];
}

/**
 * Executes a controlled freshness evaluation on a subset of repertoire songs.
 * Adheres strictly to multi-tenancy, batch/concurrency limits, and idempotency.
 */
export const executeFreshnessEvaluation = async (
  input: FreshnessExecutionInput
): Promise<FreshnessExecutionResult> => {
  const { organizationId, songIds, today, mode } = input;

  // 1. Validate inputs
  if (!organizationId) {
    throw new Error("organizationId is required");
  }
  if (!today || !isValidDateOnly(today)) {
    throw new Error(`Invalid today date format: "${today}". Expected YYYY-MM-DD.`);
  }

  const result: FreshnessExecutionResult = {
    mode,
    requested: songIds.length,
    evaluated: 0,
    wouldUpdate: 0,
    updated: 0,
    unchanged: 0,
    missing: 0,
    wrongOrganization: 0,
    invalid: 0,
    failed: 0,
    items: []
  };

  if (songIds.length === 0) {
    return result;
  }

  // Filter out duplicates and empty entries
  const uniqueSongIds = Array.from(
    new Set(songIds.filter((id) => typeof id === 'string' && id.trim() !== ''))
  );

  // Validate limits
  if (uniqueSongIds.length > 500) {
    throw new Error(`Limit exceeded: Cannot evaluate more than 500 songs in a single execution. Unique ids count: ${uniqueSongIds.length}`);
  }

  const nowIso = new Date().toISOString();
  const CONCURRENCY_LIMIT = 5;

  // Split into chunks of concurrent transactions
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueSongIds.length; i += CONCURRENCY_LIMIT) {
    chunks.push(uniqueSongIds.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (songId) => {
        const songRef = doc(db, 'songs', songId);

        let currentStatus: 'new' | 'old' | 'default' = 'default';
        let currentSource: 'auto' | 'manual' = 'auto';
        let shouldUpdate = false;
        let nextStatus: 'new' | 'old' | 'default' | undefined;
        let referenceDate: string | undefined;
        let expirationDate: string | undefined;
        let reason = '';
        let outcome: any = 'unchanged';

        try {
          if (mode === 'dry-run') {
            const snap = await firestoreGateway.getDoc(songRef);
            if (!snap.exists()) {
              outcome = 'missing';
              result.missing++;
            } else {
              const song = snap.data() as Song;
              if (song.organizationId !== organizationId) {
                outcome = 'wrong-organization';
                result.wrongOrganization++;
              } else {
                result.evaluated++;
                if (song.freshness) {
                  currentStatus = song.freshness.status || 'default';
                  currentSource = song.freshness.source || 'auto';
                } else if (song.isNew === true) {
                  currentStatus = 'new';
                  currentSource = 'auto';
                }

                const evalRes = evaluateSongFreshness(song, today);
                shouldUpdate = evalRes.shouldUpdate;
                nextStatus = evalRes.nextStatus;
                referenceDate = evalRes.referenceDate;
                expirationDate = evalRes.expirationDate;
                reason = evalRes.reason;

                if (shouldUpdate) {
                  outcome = 'would-update';
                  result.wouldUpdate++;
                } else {
                  outcome = 'unchanged';
                  result.unchanged++;
                }
              }
            }
          } else {
            // Apply mode runs atomic transaction
            await firestoreGateway.runTransaction(db, async (transaction) => {
              const snap = await transaction.get(songRef);
              if (!snap.exists()) {
                outcome = 'missing';
                return;
              }
              const song = snap.data() as Song;
              if (song.organizationId !== organizationId) {
                outcome = 'wrong-organization';
                return;
              }

              if (song.freshness) {
                currentStatus = song.freshness.status || 'default';
                currentSource = song.freshness.source || 'auto';
              } else if (song.isNew === true) {
                currentStatus = 'new';
                currentSource = 'auto';
              }

              const evalRes = evaluateSongFreshness(song, today);
              shouldUpdate = evalRes.shouldUpdate;
              nextStatus = evalRes.nextStatus;
              referenceDate = evalRes.referenceDate;
              expirationDate = evalRes.expirationDate;
              reason = evalRes.reason;

              if (shouldUpdate && nextStatus) {
                transaction.update(songRef, {
                  'freshness.status': nextStatus,
                  'freshness.source': 'auto',
                  'freshness.autoUpdatedAt': nowIso
                });
                outcome = 'updated';
              } else {
                outcome = 'unchanged';
              }
            });

            // Handle standard post-transaction counter update
            if (outcome === 'missing') {
              result.missing++;
            } else if (outcome === 'wrong-organization') {
              result.wrongOrganization++;
            } else if (outcome === 'updated') {
              result.evaluated++;
              result.updated++;
            } else if (outcome === 'unchanged') {
              result.evaluated++;
              result.unchanged++;
            }
          }
        } catch (err) {
          console.error(`Error processing song ${songId} under mode ${mode}:`, err);
          outcome = 'failed';
          reason = err instanceof Error ? err.message : String(err);
          result.failed++;
        }

        result.items.push({
          songId,
          currentStatus,
          currentSource,
          shouldUpdate,
          nextStatus,
          referenceDate,
          expirationDate,
          reason,
          outcome
        });
      })
    );
  }

  return result;
};
