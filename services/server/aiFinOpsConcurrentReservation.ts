import {
  AI_FINOPS_POLICY_VERSION,
  AiQuotaDecision,
  AiUsageOutcome,
  buildAiFinOpsEvent,
  estimateTokensFromChars,
  evaluateAiQuota,
  getAiPeriodKeys,
  resolveAiQuotaLimits,
  shouldConsumeQuotaForOutcome,
} from "./aiFinOpsPolicy.js";
import {
  AiCacheRecord,
  AiFinOpsRepositoryInput,
  AiFinOpsStorageAdapter,
  AiFinOpsTransactionAdapter,
  AiIdempotencyRecord,
  AiUsageCounters,
  assertRepositoryPayloadIsPrivate,
  buildUsageIncrement,
  classifyExistingIdempotencyRecord,
  createProcessingIdempotencyRecord,
  deriveEstimatedOutputCharsFromTokens,
  normalizeUsageCounters,
  sanitizeCacheResultSummary,
} from "./aiFinOpsRepository.js";

export type { AiFinOpsRepositoryInput, AiFinOpsStorageAdapter } from "./aiFinOpsRepository.js";

interface AiInFlightReservation {
  requestCount: 1;
  estimatedInputTokens: number;
  monthlyUsageDocPath: string;
  dailyUsageDocPath: string;
}

interface AiReservedIdempotencyRecord extends AiIdempotencyRecord {
  reservation?: AiInFlightReservation;
}

const INVALID_RESERVATION_METADATA = "AI_FINOPS_INVALID_RESERVATION_METADATA";

function safeCounter(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function validateReservationPath(path: string, organizationId: string, collection: "aiUsage" | "aiDailyUsage"): boolean {
  const prefix = `organizations/${organizationId}/${collection}/`;
  if (!path.startsWith(prefix)) return false;
  const suffix = path.slice(prefix.length);
  return suffix.length > 0 && !suffix.includes("/");
}

function readReservation(
  record: AiReservedIdempotencyRecord | null,
  organizationId: string
): AiInFlightReservation | null {
  if (!record?.reservation) return null;

  const raw = record.reservation as Partial<AiInFlightReservation>;
  const inputTokens = safeCounter(raw.estimatedInputTokens);
  const valid =
    raw.requestCount === 1 &&
    typeof raw.monthlyUsageDocPath === "string" &&
    typeof raw.dailyUsageDocPath === "string" &&
    validateReservationPath(raw.monthlyUsageDocPath, organizationId, "aiUsage") &&
    validateReservationPath(raw.dailyUsageDocPath, organizationId, "aiDailyUsage");

  if (!valid) {
    throw new Error(INVALID_RESERVATION_METADATA);
  }

  return {
    requestCount: 1,
    estimatedInputTokens: inputTokens,
    monthlyUsageDocPath: raw.monthlyUsageDocPath!,
    dailyUsageDocPath: raw.dailyUsageDocPath!,
  };
}

function stripReservation(record: AiReservedIdempotencyRecord): AiIdempotencyRecord {
  const { reservation: _reservation, ...rest } = record;
  return rest;
}

function reserveInputCapacity(
  counters: AiUsageCounters,
  estimatedInputTokens: number,
  nowIso: string
): AiUsageCounters {
  const inputTokens = safeCounter(estimatedInputTokens);
  return {
    requestCount: counters.requestCount + 1,
    estimatedInputTokens: counters.estimatedInputTokens + inputTokens,
    estimatedOutputTokens: counters.estimatedOutputTokens,
    estimatedTotalTokens: counters.estimatedTotalTokens + inputTokens,
    createdAtIso: counters.createdAtIso || nowIso,
    updatedAtIso: nowIso,
  };
}

function releaseInputCapacity(
  counters: AiUsageCounters,
  reservation: AiInFlightReservation,
  nowIso: string
): AiUsageCounters {
  return {
    requestCount: Math.max(0, counters.requestCount - reservation.requestCount),
    estimatedInputTokens: Math.max(0, counters.estimatedInputTokens - reservation.estimatedInputTokens),
    estimatedOutputTokens: counters.estimatedOutputTokens,
    estimatedTotalTokens: Math.max(0, counters.estimatedTotalTokens - reservation.estimatedInputTokens),
    createdAtIso: counters.createdAtIso || nowIso,
    updatedAtIso: nowIso,
  };
}

function addSuccessfulOutput(
  counters: AiUsageCounters,
  estimatedOutputTokens: number,
  nowIso: string
): AiUsageCounters {
  const outputTokens = safeCounter(estimatedOutputTokens);
  return {
    requestCount: counters.requestCount,
    estimatedInputTokens: counters.estimatedInputTokens,
    estimatedOutputTokens: counters.estimatedOutputTokens + outputTokens,
    estimatedTotalTokens: counters.estimatedTotalTokens + outputTokens,
    createdAtIso: counters.createdAtIso || nowIso,
    updatedAtIso: nowIso,
  };
}

async function readCounters(
  tx: AiFinOpsTransactionAdapter,
  paths: Iterable<string>
): Promise<Map<string, AiUsageCounters>> {
  const result = new Map<string, AiUsageCounters>();
  for (const path of new Set(paths)) {
    result.set(path, normalizeUsageCounters(await tx.get(path)));
  }
  return result;
}

function buildQuotaSnapshot(
  monthly: AiUsageCounters,
  daily: AiUsageCounters
) {
  return {
    monthlyRequestCount: monthly.requestCount,
    dailyRequestCount: daily.requestCount,
    monthlyEstimatedTokens: monthly.estimatedInputTokens,
    dailyEstimatedTokens: daily.estimatedInputTokens,
  };
}

async function writeDirtyCounters(
  tx: AiFinOpsTransactionAdapter,
  counters: Map<string, AiUsageCounters>,
  dirtyPaths: Set<string>
): Promise<void> {
  for (const path of dirtyPaths) {
    await tx.set(path, counters.get(path)! as any, { merge: true });
  }
}

/**
 * Concurrency-safe reservation flow for the production AI import path.
 *
 * Current request/input counters act as temporary capacity reservations while
 * an AI request is in flight. A successful finalization keeps that capacity
 * and only adds output tokens; a failed finalization refunds the reservation.
 * Firestore transaction retries therefore serialize competing requests at the
 * quota boundary without introducing a parallel quota-counter schema.
 */
export async function beginAiFinOpsReservation(
  input: AiFinOpsRepositoryInput
): Promise<{
  status: "IDEMPOTENCY_IN_FLIGHT" | "IDEMPOTENCY_COMPLETED" | "QUOTA_BLOCKED" | "RESERVED";
  quotaDecision?: AiQuotaDecision;
  existingRecord?: AiIdempotencyRecord;
}> {
  assertRepositoryPayloadIsPrivate(input);

  return input.adapter.runTransaction(async (tx) => {
    const existing = (await tx.get(input.paths.idempotencyDocPath)) as AiReservedIdempotencyRecord | null;
    const classification = classifyExistingIdempotencyRecord(existing, new Date());

    if (classification === "IN_FLIGHT") {
      return { status: "IDEMPOTENCY_IN_FLIGHT", existingRecord: existing! };
    }

    if (classification === "COMPLETED") {
      return { status: "IDEMPOTENCY_COMPLETED", existingRecord: existing! };
    }

    const staleReservation = classification === "EXPIRED"
      ? readReservation(existing, input.organizationId)
      : null;

    const counterPaths = new Set<string>([
      input.paths.monthlyUsageDocPath,
      input.paths.dailyUsageDocPath,
    ]);
    if (staleReservation) {
      counterPaths.add(staleReservation.monthlyUsageDocPath);
      counterPaths.add(staleReservation.dailyUsageDocPath);
    }

    // All reads intentionally happen before the first write.
    const counters = await readCounters(tx, counterPaths);
    const dirtyPaths = new Set<string>();
    const nowIso = new Date().toISOString();

    if (staleReservation) {
      const oldMonthly = counters.get(staleReservation.monthlyUsageDocPath)!;
      const oldDaily = counters.get(staleReservation.dailyUsageDocPath)!;
      counters.set(
        staleReservation.monthlyUsageDocPath,
        releaseInputCapacity(oldMonthly, staleReservation, nowIso)
      );
      counters.set(
        staleReservation.dailyUsageDocPath,
        releaseInputCapacity(oldDaily, staleReservation, nowIso)
      );
      dirtyPaths.add(staleReservation.monthlyUsageDocPath);
      dirtyPaths.add(staleReservation.dailyUsageDocPath);
    }

    const monthlyCounters = counters.get(input.paths.monthlyUsageDocPath)!;
    const dailyCounters = counters.get(input.paths.dailyUsageDocPath)!;
    const estimatedInputTokens = estimateTokensFromChars(input.inputChars || 0);
    const limits = resolveAiQuotaLimits({
      plan: input.plan,
      featureEnabled: true,
      overrides: input.overrides,
    });
    const quotaDecision = evaluateAiQuota({
      limits,
      usage: buildQuotaSnapshot(monthlyCounters, dailyCounters),
      estimatedInputTokens,
    });

    if (!quotaDecision.allowed) {
      if (staleReservation) {
        await writeDirtyCounters(tx, counters, dirtyPaths);
        const cleanedExisting: AiIdempotencyRecord = {
          ...stripReservation(existing!),
          status: "EXPIRED",
          updatedAtIso: nowIso,
        };
        await tx.set(input.paths.idempotencyDocPath, cleanedExisting as any, { merge: false });
      }
      return { status: "QUOTA_BLOCKED", quotaDecision };
    }

    counters.set(
      input.paths.monthlyUsageDocPath,
      reserveInputCapacity(monthlyCounters, estimatedInputTokens, nowIso)
    );
    counters.set(
      input.paths.dailyUsageDocPath,
      reserveInputCapacity(dailyCounters, estimatedInputTokens, nowIso)
    );
    dirtyPaths.add(input.paths.monthlyUsageDocPath);
    dirtyPaths.add(input.paths.dailyUsageDocPath);

    const reservation: AiInFlightReservation = {
      requestCount: 1,
      estimatedInputTokens,
      monthlyUsageDocPath: input.paths.monthlyUsageDocPath,
      dailyUsageDocPath: input.paths.dailyUsageDocPath,
    };
    const processingRecord: AiReservedIdempotencyRecord = {
      ...createProcessingIdempotencyRecord({
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
        cacheKey: input.cacheKey,
      }),
      reservation,
    };

    await writeDirtyCounters(tx, counters, dirtyPaths);
    await tx.set(input.paths.idempotencyDocPath, processingRecord as any, { merge: false });

    return { status: "RESERVED", quotaDecision };
  });
}

/**
 * Finalizes a concurrency-safe reservation exactly once.
 *
 * The idempotency record is read first and must still belong to the same
 * PROCESSING request. Every usage read occurs before any event/counter/status
 * write, matching Firestore transaction ordering rules.
 */
export async function finalizeAiFinOpsReservation(
  input: AiFinOpsRepositoryInput & {
    outcome: AiUsageOutcome;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    cacheSummary?: any;
    errorCode?: string | null;
    durationMs?: number;
    expirationSeconds?: number;
  }
): Promise<void> {
  assertRepositoryPayloadIsPrivate(input);

  const { monthKey, dayKey } = getAiPeriodKeys();
  const event = buildAiFinOpsEvent({
    requestId: input.requestId,
    organizationId: input.organizationId,
    uid: input.uid,
    feature: "aiImport",
    endpoint: "ai-import",
    model: input.model,
    sourceType: input.sourceType,
    sourceHost: input.sourceHost,
    inputChars: input.inputChars || 0,
    outputChars: deriveEstimatedOutputCharsFromTokens(input.estimatedOutputTokens),
    outcome: input.outcome,
    status: input.outcome === "SUCCESS" ? "succeeded" : "failed",
    cacheHit: input.outcome === "CACHE_HIT",
    idempotencyHit: input.outcome === "IDEMPOTENCY_HIT",
    periodMonthKey: monthKey,
    periodDayKey: dayKey,
    billingPlanSnapshot: input.plan,
    errorCode: input.errorCode,
    durationMs: input.durationMs,
  });
  assertRepositoryPayloadIsPrivate(event);

  await input.adapter.runTransaction(async (tx) => {
    const existing = (await tx.get(input.paths.idempotencyDocPath)) as AiReservedIdempotencyRecord | null;

    // Stale/repeated finalizers must never write counters or events twice.
    if (!existing || existing.requestId !== input.requestId || existing.status !== "PROCESSING") {
      return;
    }

    const reservation = readReservation(existing, input.organizationId);
    const counterPaths = new Set<string>([
      input.paths.monthlyUsageDocPath,
      input.paths.dailyUsageDocPath,
    ]);
    if (reservation) {
      counterPaths.add(reservation.monthlyUsageDocPath);
      counterPaths.add(reservation.dailyUsageDocPath);
    }

    // All reads intentionally happen before the first write.
    const counters = await readCounters(tx, counterPaths);
    const dirtyPaths = new Set<string>();
    const nowIso = new Date().toISOString();
    const mustConsume = shouldConsumeQuotaForOutcome(input.outcome);

    if (reservation) {
      if (mustConsume) {
        const monthly = counters.get(reservation.monthlyUsageDocPath)!;
        const daily = counters.get(reservation.dailyUsageDocPath)!;
        counters.set(
          reservation.monthlyUsageDocPath,
          addSuccessfulOutput(monthly, input.estimatedOutputTokens, nowIso)
        );
        counters.set(
          reservation.dailyUsageDocPath,
          addSuccessfulOutput(daily, input.estimatedOutputTokens, nowIso)
        );
      } else {
        const monthly = counters.get(reservation.monthlyUsageDocPath)!;
        const daily = counters.get(reservation.dailyUsageDocPath)!;
        counters.set(
          reservation.monthlyUsageDocPath,
          releaseInputCapacity(monthly, reservation, nowIso)
        );
        counters.set(
          reservation.dailyUsageDocPath,
          releaseInputCapacity(daily, reservation, nowIso)
        );
      }
      dirtyPaths.add(reservation.monthlyUsageDocPath);
      dirtyPaths.add(reservation.dailyUsageDocPath);
    } else if (mustConsume) {
      // Compatibility for a PROCESSING record created before atomic reservations existed.
      const increments = buildUsageIncrement({
        estimatedInputTokens: input.estimatedInputTokens,
        estimatedOutputTokens: input.estimatedOutputTokens,
      });
      const monthly = counters.get(input.paths.monthlyUsageDocPath)!;
      const daily = counters.get(input.paths.dailyUsageDocPath)!;
      counters.set(input.paths.monthlyUsageDocPath, {
        requestCount: monthly.requestCount + increments.requestCount,
        estimatedInputTokens: monthly.estimatedInputTokens + increments.estimatedInputTokens,
        estimatedOutputTokens: monthly.estimatedOutputTokens + increments.estimatedOutputTokens,
        estimatedTotalTokens: monthly.estimatedTotalTokens + increments.estimatedTotalTokens,
        createdAtIso: monthly.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      });
      counters.set(input.paths.dailyUsageDocPath, {
        requestCount: daily.requestCount + increments.requestCount,
        estimatedInputTokens: daily.estimatedInputTokens + increments.estimatedInputTokens,
        estimatedOutputTokens: daily.estimatedOutputTokens + increments.estimatedOutputTokens,
        estimatedTotalTokens: daily.estimatedTotalTokens + increments.estimatedTotalTokens,
        createdAtIso: daily.createdAtIso || nowIso,
        updatedAtIso: nowIso,
      });
      dirtyPaths.add(input.paths.monthlyUsageDocPath);
      dirtyPaths.add(input.paths.dailyUsageDocPath);
    }

    const eventDocPath = `${input.paths.monthlyEventsCollectionPath}/${input.requestId}`;
    await tx.set(eventDocPath, event as any, { merge: false });
    await writeDirtyCounters(tx, counters, dirtyPaths);

    const isCompletedOutcome =
      input.outcome === "SUCCESS" ||
      input.outcome === "CACHE_HIT" ||
      input.outcome === "IDEMPOTENCY_HIT";
    const finalizedRecord: AiIdempotencyRecord = {
      ...stripReservation(existing),
      status: isCompletedOutcome ? "COMPLETED" : "FAILED",
      updatedAtIso: nowIso,
      outcome: input.outcome,
      eventPath: eventDocPath,
    };
    await tx.set(input.paths.idempotencyDocPath, finalizedRecord as any, { merge: false });

    if (mustConsume && input.cacheSummary) {
      const sanitizedSummary = sanitizeCacheResultSummary(input.cacheSummary);
      const expiresSeconds = input.expirationSeconds || 604800;
      const cacheRecord: AiCacheRecord = {
        cacheKey: input.cacheKey,
        status: "READY",
        requestId: input.requestId,
        createdAtIso: nowIso,
        expiresAtIso: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
        sourceType: input.sourceType,
        sourceHost: input.sourceHost || null,
        model: input.model,
        policyVersion: AI_FINOPS_POLICY_VERSION,
        resultSummary: sanitizedSummary,
      };
      await tx.set(input.paths.cacheDocPath, cacheRecord as any, { merge: false });
    }
  });
}
