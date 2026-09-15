import { MusicRepository } from './MusicRepository';
import type { BandScale, Scale, UserProfile } from '../types';

type MusicScaleCommandPayload = {
  bandScaleId?: string | null;
  scalePatch?: Record<string, unknown> & { bandScaleId?: string | null };
  [key: string]: unknown;
};

/**
 * Keeps the canonical one-to-one relationship between an event BandScale and a
 * MusicScale while still allowing leaders to reuse a previous formation.
 *
 * The existing UI intentionally exposes previous BandScales as reusable choices.
 * A BandScale that already belongs to another MusicScale must therefore be
 * materialized as a new event instance instead of stealing the old backlink or
 * failing with BAND_SCALE_ALREADY_LINKED.
 */
export class ReuseAwareMusicRepository extends MusicRepository {
  constructor(orgId: string, userProfile?: UserProfile | null) {
    super(orgId, userProfile);

    const baseCommands = this.musicScaleCommands;

    this.musicScaleCommands = {
      save: async (musicScaleId: string, payload: MusicScaleCommandPayload, idempotencyKey: string) => {
        const normalizedPayload = await this.normalizeBandReusePayload(musicScaleId, payload);
        try {
          return await baseCommands.save(musicScaleId, normalizedPayload, idempotencyKey);
        } catch (error: any) {
          if (error?.code !== 'BAND_SCALE_ALREADY_LINKED') throw error;

          const retryPayload = await this.normalizeBandReusePayload(musicScaleId, payload, true);
          if (retryPayload === payload) throw error;
          return await baseCommands.save(musicScaleId, retryPayload, idempotencyKey);
        }
      },
      publish: async (musicScaleId: string, payload: MusicScaleCommandPayload, idempotencyKey: string) => {
        const normalizedPayload = await this.normalizeBandReusePayload(musicScaleId, payload);
        try {
          return await baseCommands.publish(musicScaleId, normalizedPayload, idempotencyKey);
        } catch (error: any) {
          if (error?.code !== 'BAND_SCALE_ALREADY_LINKED') throw error;

          const retryPayload = await this.normalizeBandReusePayload(musicScaleId, payload, true);
          if (retryPayload === payload) throw error;
          return await baseCommands.publish(musicScaleId, retryPayload, idempotencyKey);
        }
      }
    };
  }

  override async linkScales(musicScaleId: string, bandScaleId: string) {
    const sourceBandScale = await this.bandScales.getById(bandScaleId);
    let effectiveBandScaleId = bandScaleId;

    if (
      sourceBandScale?.musicScaleId &&
      sourceBandScale.musicScaleId !== musicScaleId
    ) {
      const musicScale = await this.scales.getById(musicScaleId);
      effectiveBandScaleId = await this.materializeReusableBandScale(
        musicScaleId,
        sourceBandScale,
        musicScale || undefined,
        {}
      );
    }

    return await super.linkScales(musicScaleId, effectiveBandScaleId);
  }

  private getRequestedBandScaleId(payload: MusicScaleCommandPayload): string | null {
    const patchBandScaleId = payload?.scalePatch?.bandScaleId;
    const rootBandScaleId = payload?.bandScaleId;
    const value = rootBandScaleId !== undefined ? rootBandScaleId : patchBandScaleId;
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private replaceBandScaleId(
    payload: MusicScaleCommandPayload,
    bandScaleId: string
  ): MusicScaleCommandPayload {
    const nextPayload: MusicScaleCommandPayload = {
      ...payload,
      scalePatch: {
        ...(payload.scalePatch || {}),
        bandScaleId
      }
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'bandScaleId')) {
      nextPayload.bandScaleId = bandScaleId;
    }

    return nextPayload;
  }

  private async normalizeBandReusePayload(
    musicScaleId: string,
    payload: MusicScaleCommandPayload,
    force = false
  ): Promise<MusicScaleCommandPayload> {
    const requestedBandScaleId = this.getRequestedBandScaleId(payload);
    if (!requestedBandScaleId) return payload;

    try {
      const sourceBandScale = await this.bandScales.getById(requestedBandScaleId);
      if (!sourceBandScale) return payload;

      const linkedElsewhere = Boolean(
        sourceBandScale.musicScaleId &&
        sourceBandScale.musicScaleId !== musicScaleId
      );
      if (!linkedElsewhere && !force) return payload;
      if (!linkedElsewhere) return payload;

      const currentScale = await this.scales.getById(musicScaleId);
      const materializedBandScaleId = await this.materializeReusableBandScale(
        musicScaleId,
        sourceBandScale,
        currentScale || undefined,
        payload.scalePatch || {}
      );

      return this.replaceBandScaleId(payload, materializedBandScaleId);
    } catch (error) {
      // Do not turn a best-effort compatibility preflight into a new blocker.
      // The canonical command API remains the authority and will fail closed if
      // tenant/RBAC validation is not satisfied.
      console.warn('[MusicScale] Could not materialize reusable band formation before command', error);
      return payload;
    }
  }

  private async materializeReusableBandScale(
    musicScaleId: string,
    sourceBandScale: BandScale,
    currentScale?: Scale,
    patch: Record<string, unknown> = {}
  ): Promise<string> {
    const sourceBandScaleId = sourceBandScale.id;

    // Reuse an earlier materialization if a previous request reached Firestore
    // but the command response was interrupted. This avoids orphan duplicates.
    const existing = (await this.bandScales.list()).find((candidate: BandScale) => {
      const candidateAny = candidate as BandScale & { reuseSourceBandScaleId?: string };
      return candidate.musicScaleId === musicScaleId &&
        candidateAny.reuseSourceBandScaleId === sourceBandScaleId;
    });
    if (existing?.id) return existing.id;

    const eventDate = typeof patch.date === 'string'
      ? patch.date
      : currentScale?.date || sourceBandScale.date;
    const eventTime = patch.time === null || typeof patch.time === 'string'
      ? patch.time as string | null
      : currentScale?.time ?? sourceBandScale.time;
    const eventTimeZone = typeof patch.timeZone === 'string'
      ? patch.timeZone
      : currentScale?.timeZone ?? sourceBandScale.timeZone;
    const eventTypeId = typeof patch.eventTypeId === 'string'
      ? patch.eventTypeId
      : currentScale?.eventTypeId || sourceBandScale.eventTypeId;
    const locationId = typeof patch.locationId === 'string'
      ? patch.locationId
      : currentScale?.locationId || sourceBandScale.locationId;
    const eventNameId = patch.eventNameId === null || typeof patch.eventNameId === 'string'
      ? patch.eventNameId as string | null
      : currentScale?.eventNameId ?? sourceBandScale.eventNameId ?? null;

    const clonePayload = {
      date: eventDate,
      time: eventTime,
      timeZone: eventTimeZone,
      observations: sourceBandScale.observations || '',
      assignments: Array.isArray(sourceBandScale.assignments)
        ? sourceBandScale.assignments.map(assignment => ({ ...assignment }))
        : [],
      eventTypeId,
      locationId,
      eventNameId,
      musicScaleId,
      reuseSourceBandScaleId: sourceBandScaleId
    } as any;

    if (!clonePayload.assignments.length) {
      throw new Error('A formação selecionada não possui integrantes válidos para reutilização.');
    }

    const clonedBandScaleId = await this.bandScales.create(clonePayload);
    console.info('[MusicScale] Reused linked band formation through a new event BandScale', {
      sourceBandScaleId,
      clonedBandScaleId,
      musicScaleId
    });
    return clonedBandScaleId;
  }
}
