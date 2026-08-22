import { describe, expect, it } from 'vitest';
import {
  AiFinOpsRepositoryInput,
  AiFinOpsStorageAdapter,
  AiFinOpsTransactionAdapter,
  createProcessingIdempotencyRecord,
} from '../../services/server/aiFinOpsRepository.js';
import {
  beginAiFinOpsReservation,
  finalizeAiFinOpsReservation,
} from '../../services/server/aiFinOpsConcurrentReservation.js';

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

class SerialFirestoreLikeAdapter implements AiFinOpsStorageAdapter {
  private docs = new Map<string, Record<string, any>>();
  private tail: Promise<void> = Promise.resolve();

  seed(path: string, value: Record<string, any>): void {
    this.docs.set(path, clone(value));
  }

  read(path: string): Record<string, any> | null {
    return this.docs.has(path) ? clone(this.docs.get(path)!) : null;
  }

  async runTransaction<T>(fn: (tx: AiFinOpsTransactionAdapter) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const working = new Map<string, Record<string, any>>(
      Array.from(this.docs.entries(), ([path, value]) => [path, clone(value)])
    );
    let writeStarted = false;

    const tx: AiFinOpsTransactionAdapter = {
      get: async (path) => {
        if (writeStarted) {
          throw new Error('TEST_FIRESTORE_READ_AFTER_WRITE');
        }
        return working.has(path) ? clone(working.get(path)!) : null;
      },
      create: async (path, data) => {
        writeStarted = true;
        if (working.has(path)) throw new Error('TEST_FIRESTORE_ALREADY_EXISTS');
        working.set(path, clone(data));
      },
      set: async (path, data, options) => {
        writeStarted = true;
        if (options?.merge && working.has(path)) {
          working.set(path, { ...working.get(path)!, ...clone(data) });
        } else {
          working.set(path, clone(data));
        }
      },
      update: async (path, data) => {
        writeStarted = true;
        if (!working.has(path)) throw new Error('TEST_FIRESTORE_NOT_FOUND');
        working.set(path, { ...working.get(path)!, ...clone(data) });
      },
    };

    try {
      const result = await fn(tx);
      this.docs = working;
      return result;
    } finally {
      release();
    }
  }
}

const MONTHLY_PATH = 'organizations/org-1/aiUsage/2026-08';
const DAILY_PATH = 'organizations/org-1/aiDailyUsage/2026-08-22';
const EVENTS_PATH = `${MONTHLY_PATH}/events`;

function makeInput(
  adapter: AiFinOpsStorageAdapter,
  idempotencyKey: string,
  requestId: string,
  overrides: AiFinOpsRepositoryInput['overrides'] = {
    enabled: true,
    monthlyRequests: 1,
    dailyRequests: 1,
    monthlyEstimatedTokens: 100,
    dailyEstimatedTokens: 100,
  }
): AiFinOpsRepositoryInput {
  return {
    adapter,
    paths: {
      monthlyUsageDocPath: MONTHLY_PATH,
      dailyUsageDocPath: DAILY_PATH,
      monthlyEventsCollectionPath: EVENTS_PATH,
      idempotencyDocPath: `organizations/org-1/aiIdempotency/${idempotencyKey}`,
      cacheDocPath: `organizations/org-1/aiCache/cache-${idempotencyKey}`,
      rateLimitDocPath: `organizations/org-1/aiRateLimits/rate-${idempotencyKey}`,
    },
    requestId,
    organizationId: 'org-1',
    uid: 'user-1',
    idempotencyKey,
    cacheKey: `cache-${idempotencyKey}`,
    sourceType: 'rawText',
    sourceHost: null,
    model: 'gemini-test',
    plan: 'pro',
    inputChars: 40,
    overrides,
  };
}

describe('AI FinOps concurrent quota reservation', () => {
  it('allows only one of two distinct concurrent requests at a one-request quota boundary', async () => {
    const adapter = new SerialFirestoreLikeAdapter();
    const [first, second] = await Promise.all([
      beginAiFinOpsReservation(makeInput(adapter, 'key-a', 'request-a')),
      beginAiFinOpsReservation(makeInput(adapter, 'key-b', 'request-b')),
    ]);

    expect([first.status, second.status].sort()).toEqual(['QUOTA_BLOCKED', 'RESERVED']);
    expect(adapter.read(MONTHLY_PATH)).toMatchObject({
      requestCount: 1,
      estimatedInputTokens: 10,
      estimatedTotalTokens: 10,
    });
    expect(adapter.read(DAILY_PATH)).toMatchObject({
      requestCount: 1,
      estimatedInputTokens: 10,
      estimatedTotalTokens: 10,
    });
  });

  it('refunds an in-flight reservation after a failed AI outcome', async () => {
    const adapter = new SerialFirestoreLikeAdapter();
    const input = makeInput(adapter, 'key-fail', 'request-fail');

    expect((await beginAiFinOpsReservation(input)).status).toBe('RESERVED');
    await finalizeAiFinOpsReservation({
      ...input,
      outcome: 'GEMINI_ERROR',
      estimatedInputTokens: 10,
      estimatedOutputTokens: 0,
    });

    expect(adapter.read(MONTHLY_PATH)).toMatchObject({
      requestCount: 0,
      estimatedInputTokens: 0,
      estimatedTotalTokens: 0,
    });
    expect(adapter.read(DAILY_PATH)).toMatchObject({
      requestCount: 0,
      estimatedInputTokens: 0,
      estimatedTotalTokens: 0,
    });

    expect((await beginAiFinOpsReservation(makeInput(adapter, 'key-after-fail', 'request-after-fail'))).status)
      .toBe('RESERVED');
  });

  it('keeps the successful reservation, adds output once, and makes repeated finalization a no-op', async () => {
    const adapter = new SerialFirestoreLikeAdapter();
    const input = makeInput(adapter, 'key-success', 'request-success');

    expect((await beginAiFinOpsReservation(input)).status).toBe('RESERVED');
    const finalInput = {
      ...input,
      outcome: 'SUCCESS' as const,
      estimatedInputTokens: 10,
      estimatedOutputTokens: 5,
      cacheSummary: { title: 'Safe title', artist: 'Safe artist', hasLyrics: true },
    };

    await finalizeAiFinOpsReservation(finalInput);
    expect(adapter.read(MONTHLY_PATH)).toMatchObject({
      requestCount: 1,
      estimatedInputTokens: 10,
      estimatedOutputTokens: 5,
      estimatedTotalTokens: 15,
    });
    expect(adapter.read(input.paths.idempotencyDocPath)).toMatchObject({
      status: 'COMPLETED',
      requestId: 'request-success',
      outcome: 'SUCCESS',
    });
    expect(adapter.read(input.paths.idempotencyDocPath)?.reservation).toBeUndefined();

    await finalizeAiFinOpsReservation(finalInput);
    expect(adapter.read(MONTHLY_PATH)).toMatchObject({
      requestCount: 1,
      estimatedInputTokens: 10,
      estimatedOutputTokens: 5,
      estimatedTotalTokens: 15,
    });
  });

  it('keeps compatibility with a legacy PROCESSING record that had no reservation metadata', async () => {
    const adapter = new SerialFirestoreLikeAdapter();
    const input = makeInput(adapter, 'key-legacy', 'request-legacy', {
      enabled: true,
      monthlyRequests: 10,
      dailyRequests: 10,
      monthlyEstimatedTokens: 1000,
      dailyEstimatedTokens: 1000,
    });
    adapter.seed(
      input.paths.idempotencyDocPath,
      createProcessingIdempotencyRecord({
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
        cacheKey: input.cacheKey,
      })
    );

    await finalizeAiFinOpsReservation({
      ...input,
      outcome: 'SUCCESS',
      estimatedInputTokens: 10,
      estimatedOutputTokens: 5,
    });

    expect(adapter.read(MONTHLY_PATH)).toMatchObject({
      requestCount: 1,
      estimatedInputTokens: 10,
      estimatedOutputTokens: 5,
      estimatedTotalTokens: 15,
    });
  });
});
